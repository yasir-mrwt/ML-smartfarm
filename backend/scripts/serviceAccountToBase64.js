import fs from "node:fs";
import path from "node:path";

const serviceAccountPath = path.resolve(
  process.argv[2] || "./serviceAccountKey.json",
);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`Service account not found: ${serviceAccountPath}`);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8"),
);

if (
  serviceAccount.type !== "service_account" ||
  !serviceAccount.private_key ||
  !serviceAccount.client_email
) {
  throw new Error("File is not a valid Firebase service-account JSON");
}

process.stdout.write(
  Buffer.from(JSON.stringify(serviceAccount), "utf8").toString("base64"),
);
