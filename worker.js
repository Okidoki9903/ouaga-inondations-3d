// Cloudflare Worker: sert les fichiers statiques (Workers Static Assets, dossier docs/)
export default {async fetch(req,env){return env.ASSETS.fetch(req)}};
