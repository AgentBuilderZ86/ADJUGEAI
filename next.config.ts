import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // PDF de CPS/RC jusqu'à 4 Mo (limite des fonctions Netlify : 6 Mo avec l'encodage)
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
