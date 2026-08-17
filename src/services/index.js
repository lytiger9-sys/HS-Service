import { createGuildStateService } from "./guildState.js";
import { createSettingsService } from "./settingsService.js";
import { createNotesService } from "./notesService.js";
import { createPunishmentsService } from "./punishmentsService.js";
import { createModerationService } from "./moderationService.js";
import { createTicketService } from "./ticketService.js";
import { createPollService } from "./pollService.js";
import { createTempChannelService } from "./tempChannelService.js";
import { createServerInfoService } from "./serverInfoService.js";
import { createLogService } from "./logService.js";
import { createHoneypotService } from "./honeypotService.js";
import { createAssignmentService } from "./assignmentService.js";
import { createMessageLogService } from "./messageLogService.js";
import { createStaffService } from "./staffService.js";
import { createLicenseService } from "./licenseService.js";
import { createPartnerService } from "./partnerService.js";
import { createOverviewChannelService } from "./overviewChannelService.js";
import { createEmbedService } from "./embedService.js";

export function createServices(context) {
  const guildState = createGuildStateService(context);

  return {
    guildState,
    settings: createSettingsService(context, guildState),
    notes: createNotesService(context, guildState),
    punishments: createPunishmentsService(context, guildState),
    logs: createLogService(context, guildState),
    moderation: createModerationService(context, guildState),
    tickets: createTicketService(context, guildState),
    polls: createPollService(context, guildState),
    tempChannels: createTempChannelService(context, guildState),
    serverInfo: createServerInfoService(context, guildState),
    honeypot: createHoneypotService(context, guildState),
    assignment: createAssignmentService(context, guildState),
    messageLogs: createMessageLogService(context),
    staff: createStaffService(context, guildState),
    licenses: createLicenseService(),
    partners: createPartnerService(context),
    overviewChannels: createOverviewChannelService(context),
    embeds: createEmbedService(context)
  };
}
