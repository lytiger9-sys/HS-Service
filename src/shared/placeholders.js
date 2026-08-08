function stringify(value) {
  if (value == null) {
    return "";
  }

  return String(value);
}

export function applyPlaceholders(template, context = {}) {
  const replacements = {
    user: stringify(context.user?.toString?.() ?? context.userTag ?? context.username),
    guild: stringify(context.guild?.name ?? context.guildName),
    totalmember: stringify(context.totalmember ?? context.totalMembers ?? context.memberCount)
  };

  return stringify(template).replace(/\{(user|guild|totalmember)\}/g, (_match, key) => {
    return replacements[key] ?? "";
  });
}
