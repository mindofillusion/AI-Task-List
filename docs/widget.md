# AI Task List sur le CORSAIR XENEON EDGE

AI Task List affiche les tâches en cours et les résultats non lus. Il actualise l’écran lorsque le collecteur met à jour le fichier local `%USERPROFILE%\AI-Task-List\tasks.json`.

## Installer le widget

1. Vérifiez que le XENEON EDGE apparaît dans iCUE sous Windows. Le widget nécessite iCUE 5.52 ou ultérieur.
2. Téléchargez le [fichier AI-Task-List-2.0.0.icuewidget](https://github.com/mindofillusion/AI-Task-List/releases/download/v2.0.0/AI-Task-List-2.0.0.icuewidget).
3. Dans iCUE, sélectionnez le XENEON EDGE, ouvrez la bibliothèque de widgets et utilisez le bouton **+** pour importer le fichier. Autorisez iCUE à lire `<Home>/AI-Task-List/tasks.json` lorsque la demande s’affiche. Ajoutez **AI Task List** à une page de l’écran. [Guide d’importation Corsair](https://www.corsair.com/uk/en/explorer/diy-builder/accessories/how-to-install-a-widget/)
4. Démarrez le collecteur avec les [instructions du projet](../README.md#installer-sous-windows). Pour un essai depuis les sources, ouvrez PowerShell à la racine du dépôt avec Node.js 26 ou ultérieur et lancez la commande ci-dessous. Gardez la fenêtre ouverte pendant l’essai.

```powershell
node .\collector\main.cjs
```

Pour suivre les tâches Codex, Work ou ChatGPT, ouvrez l’application de bureau dans la même session Windows. Une tâche lancée ailleurs devient visible dès que son état est disponible dans cette application.

## Lire et personnaliser l’affichage

- **Orange** indique une tâche en cours. **Vert** indique un résultat terminé et non lu. Le résultat disparaît lorsque sa source le marque comme lu.
- La deuxième ligne affiche l’origine de la tâche, le modèle et l’effort de raisonnement disponibles. La ligne grise affiche l’état, le numéro du tour et son chrono.
- À droite, le grand chrono affiche le temps de l’objectif lorsqu’il est disponible. Dans les autres cas, il cumule le temps de traitement depuis la dernière demande utilisateur.
- Les paramètres de personnalisation d’iCUE permettent de régler les couleurs, le fond et sa transparence.

## Si aucune tâche ne s’affiche

| Affichage | Vérification |
| --- | --- |
| **Connexion au collecteur…** | Attendez l’écriture du prochain instantané. Vérifiez que le collecteur tourne sous le même compte Windows qu’iCUE. |
| **Collecteur indisponible** | Vérifiez que `tasks.json` existe, qu’il est actualisé et qu’iCUE a l’autorisation de le lire. |
| **Données Codex indisponibles** | Lancez l’application de bureau et vérifiez que le collecteur utilise le même compte Windows. |
| **Aucune tâche active** | Lancez une nouvelle demande ou attendez la remontée de l’état d’une tâche distante. |

```powershell
Get-Item -LiteralPath (Join-Path $env:USERPROFILE 'AI-Task-List\tasks.json') |
  Select-Object FullName, LastWriteTime
```

Le widget lit ce fichier en local, sans port HTTP. Le [guide des fournisseurs](providers.md) décrit comment raccorder un autre assistant IA.
