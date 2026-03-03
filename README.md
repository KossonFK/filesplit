# FileSplitter

Application desktop (Windows / macOS / Linux) pour découper des fichiers texte en plusieurs fichiers selon un motif regex.

## Fonctionnalités

- **Découpe par regex** : chaque correspondance marque le début d'un nouveau fichier
- **Organisation alphabétique** : les fichiers sont regroupés en sous-dossiers selon la première lettre du groupe capturant (A/, B/, 0-9/, _misc/)
- **Aperçu en temps réel** : visualisez les correspondances avant de lancer la découpe
- **Suivi de progression** : barre de progression en direct pendant la découpe
- **Historique persistant** : toutes les découpes sont enregistrées avec leur statut

## Prérequis

- [Node.js](https://nodejs.org/) v18+ 
- npm v9+

## Installation & Démarrage

```bash
# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

## Packaging (distribuer)

```bash
# Compiler + packager pour la plateforme courante
npm run dist

# Cibler macOS spécifiquement
npm run dist:mac

# Cibler Windows spécifiquement
npm run dist:win
```

Les installeurs/portables se trouvent dans le dossier `release/`.

## Structure du projet

```
filesplitter/
├── electron/
│   ├── main.js          # Processus principal Electron (IPC, FS, découpe)
│   └── preload.js       # Bridge sécurisé renderer ↔ main
├── src/
│   ├── App.jsx          # Composant racine + gestion état global
│   ├── index.css        # Système de design (variables CSS, composants)
│   ├── main.jsx         # Point d'entrée React
│   ├── components/
│   │   ├── Sidebar.jsx  # Navigation latérale
│   │   └── TitleBar.jsx # Barre de titre personnalisée
│   └── pages/
│       ├── NewSplit.jsx # Formulaire de nouvelle découpe
│       └── History.jsx  # Historique des découpes
├── index.html
├── vite.config.js
└── package.json
```

## Logique de découpe

1. Le fichier source est lu en entier
2. La regex est appliquée avec les flags `g` et `m` (multiline)
3. Chaque correspondance marque le début d'un segment
4. Le **premier groupe capturant** `(...)` détermine :
   - Le nom du fichier de sortie
   - Le sous-dossier alphabétique (première lettre)
5. Si aucun groupe n'est défini, la correspondance complète est utilisée

### Exemples de patterns

| Pattern | Usage |
|---------|-------|
| `^Chapter\s+(\w+)` | Chapitres nommés |
| `^(\d{4}-\d{2}-\d{2})` | Entrées datées |
| `^={3,}\s*(.+)\s*={3,}` | Sections délimitées |
| `^---$` | Séparateurs markdown |
| `^\[(\d+)\]` | Identifiants numériques |

## Données de l'application

L'historique est stocké dans :
- **macOS** : `~/Library/Application Support/filesplitter/filesplitter-history.json`
- **Windows** : `%APPDATA%\filesplitter\filesplitter-history.json`
- **Linux** : `~/.config/filesplitter/filesplitter-history.json`
