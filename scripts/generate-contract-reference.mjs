import fs from "node:fs";
const lines = [
  "# Contract function and event reference",
  "",
  "Generated from the supplied local Move source. Parameter order is preserved. `TxContext` is injected by Sui, not passed as a PTB argument. No Move files are modified.",
  "",
];
for (const file of ["coin", "fomo", "swap"]) {
  const source = fs
    .readFileSync(`contract/sources/${file}.move`, "utf8")
    .replace(/\/\/[^\n]*/g, "");
  const module = source.match(/module\s+([^\s{]+)/)[1];
  lines.push(
    `## ${module}`,
    "",
    "### Public functions",
    "",
    "| Function | Parameters | Returns | Visibility |",
    "| --- | --- | --- | --- |",
  );
  for (const [, vis, name, generic, params, returns] of source.matchAll(
    /public(\(package\))?\s+(?:entry\s+)?fun\s+(\w+)(<[^>]+>)?\s*\(([^)]*)\)\s*(?::([^\{]+))?\s*\{/g,
  ))
    lines.push(
      `| \`${name}${generic || ""}\` | \`${params.replace(/\s+/g, " ").trim()}\` | \`${returns?.replace(/\s+/g, " ").trim() || "()"}\` | ${vis ? "package-only; not callable by frontend" : "public"} |`,
    );
  lines.push("", "### Events", "", "| Event | Fields |", "| --- | --- |");
  for (const [, name, generic, body] of source.matchAll(
    /public struct (\w+)(<[^>]*>)? has copy,\s*drop\s*\{([^}]*)\}/g,
  ))
    lines.push(
      `| \`${name}${generic || ""}\` | \`${body.replace(/\s+/g, " ").trim()}\` |`,
    );
  lines.push("");
}
fs.writeFileSync("docs/CONTRACT_REFERENCE.md", lines.join("\n"));
