import fs from "node:fs";
const output = [
  "// Generated from the supplied Move structs. Run node scripts/generate-event-schemas.mjs.",
  'import { bcs } from "@mysten/sui/bcs";',
  "export const eventSchemas = {",
];
for (const file of ["coin", "fomo", "swap"]) {
  const code = fs
    .readFileSync(`contract/sources/${file}.move`, "utf8")
    .replace(/\/\/[^\n]*/g, "");
  for (const match of code.matchAll(
    /public struct (\w+)(?:<[^>]*>)? has copy,\s*drop\s*\{([^}]*)\}/g,
  )) {
    const fields = [...match[2].matchAll(/(\w+)\s*:\s*(Option<\w+>|\w+)/g)].map(
      ([, key, type]) => {
        const convert = (t) =>
          t.startsWith("Option<")
            ? `bcs.option(${convert(t.slice(7, -1))})`
            : ["ID", "address"].includes(t)
              ? "bcs.Address"
              : `bcs.${t}()`;
        return `${key}: ${convert(type)}`;
      },
    );
    output.push(
      `${match[1]}: bcs.struct('${match[1]}',{${fields.join(",")}}),`,
    );
  }
}
output.push("};");
fs.writeFileSync("src/lib/events/schemas.ts", output.join("\n"));
