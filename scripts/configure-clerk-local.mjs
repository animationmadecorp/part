import fs from "node:fs";
import readline from "node:readline";

const envPath = new URL("../.env.local", import.meta.url);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

function setValue(source, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(source)) return source.replace(pattern, line);
  return `${source.replace(/\s*$/, "")}\n${line}\n`;
}

const publishableKey = await ask("Colle la Publishable key Clerk (pk_test_...) puis appuie sur Entrée : ");
const secretKey = await ask("Colle la Secret key Clerk (sk_test_...) puis appuie sur Entrée : ");

if (!publishableKey.startsWith("pk_test_") || !secretKey.startsWith("sk_test_")) {
  console.error("Les clés ne correspondent pas au format de développement Clerk. Rien n’a été enregistré.");
  rl.close();
  process.exitCode = 1;
} else {
  let source = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  source = setValue(source, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publishableKey);
  source = setValue(source, "CLERK_SECRET_KEY", secretKey);
  fs.writeFileSync(envPath, source, { mode: 0o600 });
  console.log("Clerk est enregistré dans la configuration locale. Tu peux fermer ce terminal.");
  rl.close();
}
