import express from "express";
import { buildDashboardViewModel } from "../lib/dashboardData.js";
import { getAccessMessage, getAllowedGuild, resolveDashboardAccess } from "../lib/dashboardAccess.js";
import { getPlanDefinition, PLAN_DEFINITIONS, PLAN_LABELS, PLAN_TAB_LABELS } from "../../src/config/plans.js";
import { commandMap } from "../../src/bot/commands/index.js";
import { commandFeature } from "../../src/bot/interactions/slash.js";

function getActiveLicenseId(req) {
  return req.session?.activeLicenseId || "";
}

function renderActivation(res, context, message = "") {
  return res.render("activation", {
    title: "HS Service 시작하기",
    botName: context.config.botName,
    message,
    currentUser: res.locals.currentUser
  });
}

export function createIndexRouter(context) {
  const router = express.Router();

  router.get("/guide", (req, res) => {
    const permissionLabels = {
      administrator: "Administrator",
      manageGuild: "서버 관리 또는 Administrator",
      manageChannels: "채널 관리 또는 Administrator",
      manageExpressions: "표현식 관리 권한",
      conditional: "명령어별 조건 적용",
      public: "전체 사용자"
    };
    const permissions = {
      save: "administrator", savednotes: "administrator", clear: "administrator", punishments: "conditional",
      tempvoice: "administrator", staff: "administrator", honeypotban: "administrator", honeypotkick: "administrator",
      exithoneypot: "administrator", nickapply: "administrator", nickrandom: "administrator", nickinit: "administrator",
      booston: "manageGuild", boostoff: "manageGuild", 복제: "manageChannels", 카테고리삭제: "manageChannels",
      이모지스틸: "manageExpressions", 이모지삭제: "manageExpressions", 사운드스틸: "manageExpressions",
      사운드삭제: "manageExpressions", 캐시지급: "administrator", partnermsg: "administrator", 계좌설정: "administrator"
    };
    const dashboardFeatureDetails = [
      ["overview", "개요", "서버 현황과 전체 인원·봇·관리자·활성 투표·임시 음성채널 상태를 한눈에 확인합니다."],
      ["administrators", "관리자", "관리자 계정 상태와 출퇴근 현황, 서버 관리에 필요한 운영 정보를 관리합니다."],
      ["welcome", "환영", "신규 멤버 입장 시 채널과 DM으로 보낼 환영 메시지, 제목, 색상과 변수 사용을 설정합니다."],
      ["ticket", "티켓", "티켓 카테고리·질문·저장 메모와 문의 채널 운영 방식을 관리합니다."],
      ["security", "보안", "레이드 방지, 도배·욕설·초대 링크 대응과 타임아웃 및 보안 로그 설정을 관리합니다."],
      ["assignment", "할당", "메시지 버튼으로 지급할 역할과 서버 역할 기반의 자동 할당 기능을 설정합니다."],
      ["voice", "음성", "임시 음성채널 카테고리, 채널 이름, 최대 인원 등 음성채널 생성 규칙을 관리합니다."],
      ["embed", "임베드", "Components V2 공지 메시지, 채널·웹훅 전송, 이미지·푸터·예약 전송을 설정합니다."],
      ["polls", "투표", "투표 생성, 자유 입력, 결과 공개 범위, 만료일, 실시간 투표 로그와 진행 중인 투표를 관리합니다."],
      ["logs", "로그", "서버 변경·메시지·채널·역할 지급·제재 등 서버 로그를 통합 채널과 항목별로 설정합니다."],
      ["partner", "파트너", "파트너 신청·승인 채널, 파트너 채널, 홍보 웹훅과 상단배너 라이선스를 관리합니다."],
      ["nickname", "닉네임", "역할별 닉네임 접두사·접미사 규칙과 역할 획득 시 적용되는 닉네임 기능을 설정합니다."],
      ["shop", "상점", "캐시 보상, 상품 재고·구매, 도박, 상점 임베드와 생일 보상을 관리합니다."]
    ].map(([id, label, description]) => ({
      id,
      label,
      description,
      plans: PLAN_DEFINITIONS.filter((plan) => plan.tabs.includes(id)).map((plan) => plan.label)
    }));

    const commands = [...commandMap.entries()].map(([name, command]) => {
      const feature = commandFeature(name);
      return {
        name,
        description: command.data.toJSON().description || "서버 기능을 실행합니다.",
        feature: feature ? (PLAN_TAB_LABELS[feature] || feature) : "공통",
        permission: permissionLabels[permissions[name] || "public"],
        plans: PLAN_DEFINITIONS.filter((plan) => !feature || plan.tabs.includes(feature)).map((plan) => plan.label)
      };
    });
    return res.render("guide", {
      title: `${context.config.botName} 가이드`,
      botName: context.config.botName,
      currentUser: req.user || null,
      commands,
      dashboardFeatures: dashboardFeatureDetails,
      plans: PLAN_DEFINITIONS.map((plan) => ({ ...plan, tabLabels: plan.tabs.map((tab) => PLAN_TAB_LABELS[tab] || tab) }))
    });
  });

  router.get("/", async (req, res, next) => {
    try {
      if (res.locals.isAuthenticated) {
        const sessionLicense = req.session?.activeLicenseId && req.session?.activeGuildId
          ? await context.services.licenses.getActiveById(req.session.activeLicenseId, req.session.activeGuildId)
          : null;
        const access = await resolveDashboardAccess(context, req.user?.id, sessionLicense ? req.session.activeGuildId : undefined);
        if (access.allowed) {
          const viewModel = await buildDashboardViewModel(context, access.guild, access.plan);
          const requestedSection = typeof req.query.section === "string" ? req.query.section : "";
          const activeSection = viewModel.sections.some((section) => section.id === requestedSection)
            ? requestedSection
            : "overview";
          const dashboardLocals = {
            ...viewModel,
            currentUser: req.user,
            activeSection,
            saved: req.query.saved || "",
            issuedBannerKey: req.query.bannerKey || "",
            bannerError: req.query.bannerError || ""
          };
          if (req.query.partial === "partner") {
            return res.render("partials/partner-panel", {
              ...dashboardLocals,
              panelClass: () => "panel-stack"
            });
          }
          return res.render("dashboard", dashboardLocals);
        }
        if (access.status === 503 || access.status === 404) {
          return res.status(access.status).render("error", {
            title: "대시보드를 열 수 없습니다.",
            message: getAccessMessage(access)
          });
        }
      }

      const activeLicense = getActiveLicenseId(req)
        ? await context.services.licenses.getActiveById(getActiveLicenseId(req), req.session.activeGuildId)
        : null;
      if (!activeLicense) {
        if (req.session) {
          delete req.session.activeLicenseId;
          delete req.session.activeGuildId;
        }
        return renderActivation(res, context, req.query.error || "");
      }

      const plan = getPlanDefinition(activeLicense.plan);
      const tabs = plan.tabs.filter((id) => id !== "honeypot").map((id) => ({ id, label: PLAN_TAB_LABELS[id] || id }));
      const requestedTab = typeof req.query.tab === "string" ? req.query.tab : "overview";
      const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : "overview";
      return res.render("plan-dashboard", {
        title: `${plan.label} 플랜 대시보드`,
        botName: context.config.botName,
        currentUser: req.user || null,
        license: activeLicense,
        plan,
        tabs,
        activeTab,
        planLabels: PLAN_LABELS
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/activate", async (req, res, next) => {
    try {
      const guildId = String(req.body.guildId || "").trim();
      const licenseKey = String(req.body.licenseKey || "").trim();
      if (!/^\d{15,22}$/.test(guildId)) {
        return renderActivation(res, context, "올바른 Discord 서버 ID를 입력하세요.");
      }
      const guild = await context.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return renderActivation(res, context, "봇이 해당 서버에 참여하고 있지 않습니다.");
      }
      const license = await context.services.licenses.activate(licenseKey, guildId);
      if (!license) {
        return renderActivation(res, context, "라이선스 키가 유효하지 않거나 이미 사용·폐기·만료되었습니다.");
      }
      req.session.activeLicenseId = String(license._id);
      req.session.activeGuildId = guildId;
      await Promise.resolve(context.updatePresence?.()).catch(() => null);
      return res.redirect("/");
    } catch (error) {
      return next(error);
    }
  });

  router.post("/license/switch", async (req, res, next) => {
    try {
      delete req.session.activeLicenseId;
      delete req.session.activeGuildId;
      return res.redirect("/");
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
