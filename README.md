# Mes applications : anniversaires et contacts (PWA)

Espace web responsive donnant accès à deux applications : un gestionnaire d’anniversaires et un répertoire de contacts. La page d’accueil est organisée en cartes pour accueillir d’autres applications.

Le gestionnaire d’anniversaires calcule automatiquement l’âge détaillé, le décompte avant le prochain anniversaire, le nombre de jours vécus et le jour de naissance. Il propose l’ajout dans une fenêtre modale, l’édition directe dans le tableau, la recherche, l’import et l’export JSON, ainsi que l’export PDF par mois.

L’application fonctionne sur **ordinateur (Windows, macOS et Linux)** comme sur **mobile (iPhone/iOS et Android)**, en ligne et hors connexion.

**L'application est directement exploitable depuis l'url <https://anniversaire.alwaysdata.net/> ou en téléchargeant les fichiers du projet.**

## ✨ Anniversaires

### Calculs automatiques

- **Âge détaillé**, présenté en langage naturel (par exemple `34 ans, 2 mois et 12 jours`), sans afficher les unités nulles.
- **Prochain anniversaire**, avec un décompte en jours (`Aujourd'hui !`, `1 jour`, `X jours`). Les anniversaires du 29 février sont reportés au 28 février les années non bissextiles.
- **Jours vécus**, avec séparateurs de milliers.
- **Jour de naissance**, affiché en français (`Lundi` à `Dimanche`).

### Tri et recherche

- Le tri par défaut classe les anniversaires du **plus proche au plus éloigné**. Le bouton **« 📌 Trier par Prochains Anniversaires »** permet de rétablir cet ordre.
- Cliquez sur un en-tête pour trier par date de naissance, nom et prénom, âge, prochain anniversaire, jours vécus ou jour de naissance.
- La barre de recherche filtre instantanément les entrées par nom.

### Édition et suppression

- Double-cliquez sur une cellule **Date de naissance** ou **Nom & Prénom** pour modifier sa valeur.
- Appuyez sur `Entrée` ou quittez le champ pour valider ; appuyez sur `Échap` pour annuler.
- Les dates sont validées et les doublons sont empêchés.
- Cliquez sur le bouton `❌` pour supprimer une ligne, après confirmation.

### Données et persistance

- Au premier lancement, si `localStorage` est vide et que l’application est servie en HTTP ou HTTPS, elle tente de charger `anniversaire/anniversaires.json` avec `fetch()`.
- Les ajouts, modifications et suppressions sont enregistrés dans `localStorage`, pour conserver les données sur l’appareil et permettre une utilisation hors connexion.
- **« 📥 Importer JSON »** fusionne les données importées sans créer de doublons.
- **« 📤 Exporter JSON »** permet de sauvegarder ou transférer les données.

### Export PDF

- L’export, généré avec `jsPDF` et `jspdf-autotable`, produit un document A4 organisé par mois (`Janvier` à `Décembre`) et trié par jour du mois.
- Le document indique l’âge atteint et le jour de la semaine du prochain anniversaire.
- Chaque page reprend le titre dans son en-tête et affiche la pagination (`Page X sur Y`) dans son pied de page.
- Si les scripts PDF externes ne sont pas disponibles hors ligne, l’application utilise l’impression HTML (`window.print()`).

## 📇 Contacts

- Ajoutez ou modifiez un contact dans une fenêtre modale, recherchez-le par nom, numéro ou description et choisissez l’ordre d’affichage.
- Les données sont enregistrées dans le `localStorage` du navigateur. Les contacts d’exemple sont chargés au premier lancement ; ils peuvent ensuite être remplacés ou supprimés.
- Importez ou exportez une sauvegarde JSON. Le bouton **PDF** exporte tous les contacts, classés par nom, avec leur téléphone et leur description, indépendamment de la recherche et du tri affichés.
- Si les bibliothèques PDF sont indisponibles, la fenêtre d’impression permet de choisir **Enregistrer en PDF**.

### Capacités PWA

- `manifest.json` permet l’installation sur l’écran d’accueil ou le bureau.
- Le Service Worker (`sw.js`) met en cache les ressources statiques et permet l’utilisation hors connexion.

## 📁 Structure du projet

```text
.
├── index.html          # Accueil et choix des applications
├── accueil.css, index.js
├── anniversaire/       # Interface, styles, logique et données initiales
├── contact/            # Interface, styles et logique du répertoire
├── contact.html        # Redirection depuis l’ancienne adresse
├── manifest.json       # Métadonnées PWA
├── sw.js               # Cache hors ligne commun
└── README.md           # Documentation du projet
```

## Format du fichier `anniversaire/anniversaires.json`

Le fichier contient un tableau JSON d’objets avec une propriété `date` au format `JJ/MM/AAAA` et une propriété `nom` :

```json
[
  {
    "date": "15/03/1990",
    "nom": "Camille Dupont"
  },
  {
    "date": "29/02/1992",
    "nom": "Lucas Martin"
  }
]
```

## 🚀 Déploiement et hébergement

L’application est composée de fichiers statiques (HTML, CSS, JavaScript et JSON).

### Hébergement web

Sur un hébergement tel qu’Alwaysdata, GitHub Pages, Netlify ou Vercel, conservez l’arborescence du projet dans le répertoire web. L’accès en HTTPS active le chargement du JSON initial, le Service Worker et l’installation PWA. Les données existantes restent disponibles lorsque le site conserve la même origine (protocole, domaine et port).

### Test local

Pour tester le chargement du JSON et le Service Worker en local, lancez un serveur dans le dossier du projet. Les navigateurs limitent souvent ces fonctionnalités avec une URL `file://`.

```bash
python -m http.server 8000
```

Ouvrez ensuite <http://localhost:8000> dans votre navigateur.

### Mise à jour du cache

Après avoir modifié les ressources du site sur le serveur, incrémentez `CACHE_NAME` dans `sw.js` afin que les appareils téléchargent la nouvelle version. Le mode hors connexion nécessite une première visite en ligne ; les bibliothèques externes doivent avoir été mises en cache pour être disponibles hors ligne.

## 📱 Installer l’application (PWA)

### iPhone et iPad (Safari)

1. Ouvrez l’application dans Safari via HTTPS. Évitez la navigation privée et les navigateurs intégrés à d’autres applications.
2. Appuyez sur **Partager** (le carré avec une flèche vers le haut).
3. Si **Sur l’écran d’accueil** n’apparaît pas, appuyez sur **En voir plus** ou faites défiler les actions.
4. Sélectionnez **Sur l’écran d’accueil**, personnalisez éventuellement le nom, puis appuyez sur **Ajouter**.

L’icône apparaît sur l’écran d’accueil et l’application s’ouvre en mode plein écran (standalone).

### Android (Chrome)

1. Ouvrez l’application dans Google Chrome via HTTPS.
2. Appuyez sur le menu `⋮` (trois points verticaux).
3. Sélectionnez **Installer l’application** ou **Ajouter à l’écran d’accueil**.
4. Confirmez l’installation.

L’application est ajoutée au lanceur d’applications et à l’écran d’accueil.

### Windows (Chrome ou Edge)

1. Ouvrez l’application dans Microsoft Edge ou Google Chrome via HTTPS ou à l’adresse <http://localhost:8000>.
2. Cliquez sur l’icône **Installer** dans la barre d’adresse. Si elle n’est pas affichée, ouvrez le menu du navigateur et choisissez l’option d’installation de la page en tant qu’application.
3. Confirmez l’installation.

L’application s’ouvre dans sa propre fenêtre et un raccourci est créé sur le bureau ou dans le menu Démarrer.

## 🔒 Données et confidentialité

Les modifications effectuées dans le navigateur sont stockées dans `localStorage`, propre à chaque appareil et navigateur.

Sur un hébergement statique, le navigateur ne peut pas réécrire `anniversaire/anniversaires.json` sur le serveur. Utilisez **Exporter JSON** dans chaque application pour sauvegarder ses données ou les transférer vers un autre appareil, puis **Importer JSON** pour les charger.
