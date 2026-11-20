"use strict";

// -----------------------------------------------------------------------------------
// Import des fonctions nécessaires
// -----------------------------------------------------------------------------------
// Aucun import : l'accueil est autonome.

// -----------------------------------------------------------------------------------
// Déclaration des variables globales
// -----------------------------------------------------------------------------------
// Aucune variable globale n'est nécessaire.

// -----------------------------------------------------------------------------------
// Procédures évènementielles
// -----------------------------------------------------------------------------------
// L'accueil ne nécessite pas de procédure évènementielle.

// -----------------------------------------------------------------------------------
// Fonctions de traitement
// -----------------------------------------------------------------------------------
// L'enregistrement du Service Worker se fait au démarrage.

// -----------------------------------------------------------------------------------
// Programme principal
// -----------------------------------------------------------------------------------
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.error("Impossible d'activer le mode hors connexion :", error);
  });
}
