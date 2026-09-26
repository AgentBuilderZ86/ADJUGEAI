import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Commit du déploiement (fourni par Netlify au build), exposé par /api/sante
  env: { ADJUGE_VERSION: (process.env.COMMIT_REF ?? "local").slice(0, 7) },
  experimental: {
    // PDF de CPS/RC jusqu'à 4 Mo (limite des fonctions Netlify : 6 Mo avec l'encodage)
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
