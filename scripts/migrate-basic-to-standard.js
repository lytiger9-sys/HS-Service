import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { connectMongo, disconnectMongo, mongoose } from "../src/database/connect.js";

const APPLY_FLAG = "--apply";
const apply = process.argv.slice(2).includes(APPLY_FLAG);
const mongoUri = process.env.MONGODB_URI?.trim();
const mongoDbName = process.env.MONGODB_DB_NAME?.trim() || "hs_service";
const sourcePlan = "basic";
const targetPlan = "standard";

function formatCount(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
}

async function countByStatus(collection, plan) {
  const rows = await collection.aggregate([
    { $match: { plan } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  return rows.map((row) => `${row._id || "unknown"}: ${formatCount(row.count)}개`).join(", ") || "없음";
}

async function saveMigrationBackup(licenses, documents) {
  const backupDirectory = path.resolve(process.cwd(), "migration-backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDirectory, `basic-to-standard-${timestamp}.json`);
  const backup = {
    createdAt: new Date().toISOString(),
    sourcePlan,
    targetPlan,
    count: documents.length,
    licenses: documents.map((license) => ({
      id: String(license._id),
      plan: license.plan,
      status: license.status,
      assignedGuildId: license.assignedGuildId || "",
      activatedAt: license.activatedAt || null,
      expiresAt: license.expiresAt || null
    }))
  };

  await mkdir(backupDirectory, { recursive: true });
  await writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return backupPath;
}

async function main() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI가 필요합니다. .env 또는 실행 환경에 설정해 주세요.");
  }

  await connectMongo({ uri: mongoUri, dbName: mongoDbName });
  const licenses = mongoose.connection.db.collection("licenses");
  const basicLicenses = await licenses.find(
    { plan: sourcePlan },
    { projection: { _id: 1, plan: 1, status: 1, assignedGuildId: 1, activatedAt: 1, expiresAt: 1 } }
  ).toArray();
  const standardCount = await licenses.countDocuments({ plan: targetPlan });

  console.log(`[점검] Basic 라이선스: ${formatCount(basicLicenses.length)}개`);
  console.log(`[점검] Basic 상태별: ${await countByStatus(licenses, sourcePlan)}`);
  console.log(`[점검] 기존 Standard 라이선스: ${formatCount(standardCount)}개`);

  if (!apply) {
    console.log("[안전 모드] 데이터는 변경하지 않았습니다. 실제 전환은 백업 확인 후 `npm run migrate:basic-to-standard -- --apply`로 실행하세요.");
    return;
  }

  if (basicLicenses.length === 0) {
    console.log("[완료] 승격할 Basic 라이선스가 없습니다.");
    return;
  }

  const backupPath = await saveMigrationBackup(licenses, basicLicenses);
  const licenseIds = basicLicenses.map((license) => license._id);
  const result = await licenses.updateMany(
    { _id: { $in: licenseIds }, plan: sourcePlan },
    { $set: { plan: targetPlan } }
  );
  const remainingBasicCount = await licenses.countDocuments({ plan: sourcePlan });

  if (result.modifiedCount !== basicLicenses.length || remainingBasicCount !== 0) {
    throw new Error(`승격 검증에 실패했습니다. 변경: ${result.modifiedCount}/${basicLicenses.length}개, 남은 Basic: ${remainingBasicCount}개`);
  }

  console.log(`[백업] 대상 ID와 상태를 ${backupPath}에 저장했습니다.`);
  console.log(`[완료] ${formatCount(result.modifiedCount)}개 라이선스를 Basic에서 Standard로 승격했습니다.`);
  console.log(`[검증] 남은 Basic: ${formatCount(remainingBasicCount)}개`);
}

try {
  await main();
} catch (error) {
  console.error(`[실패] ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectMongo().catch(() => null);
}
