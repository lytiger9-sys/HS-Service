import "dotenv/config";
import { connectMongo, disconnectMongo, mongoose } from "../src/database/connect.js";

const APPLY_FLAG = "--apply";
const apply = process.argv.slice(2).includes(APPLY_FLAG);
const mongoUri = process.env.MONGODB_URI?.trim();
const mongoDbName = process.env.MONGODB_DB_NAME?.trim() || "hs_service";

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

async function main() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI가 필요합니다. .env 또는 실행 환경에 설정해 주세요.");
  }

  await connectMongo({ uri: mongoUri, dbName: mongoDbName });
  const licenses = mongoose.connection.db.collection("licenses");
  const standardCount = await licenses.countDocuments({ plan: "standard" });

  console.log(`[점검] Standard 라이선스: ${formatCount(standardCount)}개`);
  console.log(`[점검] 상태별: ${await countByStatus(licenses, "standard")}`);

  if (!apply) {
    console.log("[안전 모드] 데이터는 변경하지 않았습니다. 실제 전환은 백업 후 `npm run migrate:standard-to-pro -- --apply`로 실행하세요.");
    return;
  }

  if (standardCount === 0) {
    console.log("[완료] 승격할 Standard 라이선스가 없습니다.");
    return;
  }

  const result = await licenses.updateMany(
    { plan: "standard" },
    { $set: { plan: "pro" } }
  );
  const remainingStandardCount = await licenses.countDocuments({ plan: "standard" });
  const proCount = await licenses.countDocuments({ plan: "pro" });

  if (remainingStandardCount !== 0) {
    throw new Error(`승격 후에도 Standard 라이선스 ${remainingStandardCount}개가 남아 있습니다.`);
  }

  console.log(`[완료] ${formatCount(result.modifiedCount)}개 라이선스를 Standard에서 Pro로 승격했습니다.`);
  console.log(`[검증] 남은 Standard: ${formatCount(remainingStandardCount)}개, 전체 Pro: ${formatCount(proCount)}개`);
}

try {
  await main();
} catch (error) {
  console.error(`[실패] ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectMongo().catch(() => null);
}
