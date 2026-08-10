import admin from 'firebase-admin';

let app: admin.app.App | null = null;

function getServiceAccount(): admin.ServiceAccount | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    return JSON.parse(json) as admin.ServiceAccount;
  } catch {
    return null;
  }
}

export function getFcm(): any {
  if (app) return admin.messaging(app);

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin.messaging(app);
}

