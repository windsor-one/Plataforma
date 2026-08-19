import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

class RulesApiError extends Error {
  constructor(status, details) {
    super(`Firebase Rules API devolvió HTTP ${status}: ${details}`);
    this.status = status;
  }
}

function serviceAccountFromEnvironment() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!value) throw new Error("Falta el secreto FIREBASE_SERVICE_ACCOUNT.");
  const candidates = [value.trim()];
  try {
    candidates.push(Buffer.from(value.trim(), "base64").toString("utf8"));
  } catch {
    // Se intenta el JSON directo a continuación.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const account = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
      if (account?.type === "service_account" && account?.project_id && account?.private_key && account?.client_email) {
        return account;
      }
    } catch {
      // Se intenta el siguiente formato.
    }
  }

  throw new Error("FIREBASE_SERVICE_ACCOUNT debe contener el JSON completo de una cuenta de servicio de Firebase.");
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function createJwtAssertion(account) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase",
      aud: "https://oauth2.googleapis.com/token",
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const unsignedToken = `${header}.${claimSet}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  return `${unsignedToken}.${signer.sign(account.private_key, "base64url")}`;
}

async function getAccessToken(account) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createJwtAssertion(account),
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`No fue posible obtener un token temporal para Firebase Rules: ${payload.error_description || payload.error || response.status}`);
  }
  return payload.access_token;
}

async function rulesRequest(accessToken, path, options = {}) {
  const response = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new RulesApiError(response.status, payload.error?.message || text || "Error sin detalle.");
  }
  return payload;
}

async function deployFirestoreRules() {
  const account = serviceAccountFromEnvironment();
  const accessToken = await getAccessToken(account);
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  const project = `projects/${account.project_id}`;
  const ruleset = await rulesRequest(accessToken, `${project}/rulesets`, {
    method: "POST",
    body: JSON.stringify({ files: [{ name: "firestore.rules", content: rules }] }),
  });
  const releaseName = `${project}/releases/cloud.firestore`;

  try {
    await rulesRequest(accessToken, `${releaseName}?updateMask=rulesetName`, {
      method: "PATCH",
      body: JSON.stringify({ release: { name: releaseName, rulesetName: ruleset.name } }),
    });
  } catch (error) {
    if (!(error instanceof RulesApiError) || error.status !== 404) throw error;
    await rulesRequest(accessToken, `${project}/releases?releaseId=cloud.firestore`, {
      method: "POST",
      body: JSON.stringify({ release: { name: releaseName, rulesetName: ruleset.name } }),
    });
  }

  console.log(JSON.stringify({ ok: true, projectId: account.project_id, release: releaseName, ruleset: ruleset.name }));
}

deployFirestoreRules().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
