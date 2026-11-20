if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.error("Impossible d'activer le mode hors connexion :", error);
  });
}
