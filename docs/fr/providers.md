[English](../en/providers.md) | **Français**

# Ajouter un client IA

Un fournisseur est un composant qui connaît l’état des tâches d’un client IA. Il publie un instantané UTF-8 dans `%USERPROFILE%\AI-Task-List\sources\<fournisseur>.json`. Le collecteur relit les instantanés une fois par seconde, fusionne les tâches et écrit le fichier que lit iCUE.

Le nom du fichier identifie le fournisseur. Utilisez des minuscules, des chiffres et des tirets, avec une longueur maximale de 50 caractères avant l’extension. `codex.json` est réservé à l’adaptateur intégré.

```json
{
  "schemaVersion": 1,
  "updatedAt": 1794488400000,
  "tasks": [
    {
      "id": "task-42",
      "title": "Relire la configuration",
      "source": "Mon client IA",
      "model": "mon-modele",
      "effort": "medium",
      "state": "inProgress",
      "activity": "analysis",
      "startedAt": 1794488380000,
      "elapsedSeconds": 20,
      "requestElapsedSeconds": 35,
      "requestTurnNumber": 2
    }
  ]
}
```

Remplacez `updatedAt` par l’heure d’écriture en millisecondes Unix. Republiez un instantané complet à chaque changement et au moins une fois toutes les 15 secondes. Le collecteur écarte les instantanés vieux de plus de 30 secondes, de plus de 256 Kio ou horodatés à plus de cinq secondes dans le futur. Pour éviter une lecture partielle, écrivez un fichier temporaire puis renommez-le sur le fichier source.

| Champ d’une tâche | Règle |
| --- | --- |
| `id` | Obligatoire. Identifiant stable dans ce fournisseur. Les identifiants des différents fournisseurs sont isolés. |
| `state` | Obligatoire. `inProgress` ou `completedUnread`. Retirez la tâche de l’instantané quand le résultat a été lu. |
| `title`, `source`, `model`, `effort` | Libellés facultatifs. Si `source` est absent, le nom du fournisseur s’affiche. |
| `activity` | Facultatif. `analysis`, `command`, `context`, `files`, `image`, `response`, `search`, `starting`, `subagent`, `tool` ou `waiting`. |
| `startedAt`, `lastItemAt` | Horodatages Unix en millisecondes pour l’ordre initial. |
| `elapsedSeconds`, `requestElapsedSeconds`, `goalElapsedSeconds` | Entiers positifs ou nuls. Durées du tour, de la dernière demande et de l’objectif. Omettez les valeurs indisponibles. |
| `requestTurnNumber` | Numéro du tour dans la dernière demande, à partir de 1. |

Le collecteur copie uniquement les champs du tableau et expose au plus 100 tâches au widget. Le fournisseur calcule ses durées selon ce qu’il sait de l’activité. Pour tester une intégration sans lire les données Codex, lancez `.\app\node.exe .\app\main.cjs --no-codex --once` depuis le paquet extrait.
