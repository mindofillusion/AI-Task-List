[English](../en/limitations.md) | **Français**

# Données affichées et limites actuelles

Le widget affiche les tâches en cours et les résultats terminés que leur source indique comme non lus. Une tâche disparaît quand sa source cesse de la signaler. Les résultats déjà lus et l’historique des conversations restent hors de cette liste.

| Source | Données utilisables | Limites d’affichage |
| --- | --- | --- |
| **Codex et Work** | Titre, origine, état, phase de travail, modèle, effort de raisonnement, numéro de tour et chronos lorsqu’ils sont exposés par le catalogue local. | Le widget indique **Modèle inconnu** ou **Effort inconnu** si le champ manque. Le numéro de tour et les chronos apparaissent seulement si le collecteur dispose de la valeur correspondante. |
| **ChatGPT via l’application Windows** | Titre et états que le catalogue local transmet. Des métadonnées supplémentaires apparaissent quand elles sont disponibles pour la conversation. | Une conversation ChatGPT classique, notamment lancée sur un autre appareil, peut apparaître en retard, rester absente pendant la génération ou n’apparaître qu’à la fin. |
| **ChatGPT via l’extension Web** | Titre et état **En cours** ou **Terminé, non lu** à partir des marqueurs que la barre latérale rend visibles. | L’extension fournit uniquement ces informations et l’identifiant qui permet de les rapprocher des données du collecteur. Sans correspondance dans le catalogue local, le modèle et l’effort restent inconnus et aucun numéro de tour ni chrono n’est affiché. |
| **Autres clients** | Les champs que leur fournisseur envoie au collecteur. | Détecter qu’un client est ouvert signale sa présence. L’état de ses tâches nécessite un [fournisseur de données](providers.md). |

Le grand chrono affiche le temps cumulé de l’objectif quand il est fourni. Sinon, il affiche le temps de traitement cumulé depuis la dernière demande. La petite ligne affiche le tour et sa durée quand ces informations sont disponibles. Un message envoyé avec **Réorienter** pendant une demande conserve le chrono de cette demande.

Le pied du widget affiche les fenêtres de quota **Codex / Work** renvoyées pour le compte courant. Leur durée dépend du compte et de ce que le service transmet. Un compte peut, par exemple, n’afficher que la fenêtre de sept jours. Le pied disparaît quand aucune fenêtre valide n’est disponible. L’usage de ChatGPT classique n’entre pas dans ces compteurs.

## Suivi depuis un autre appareil

Le PC qui héberge iCUE doit disposer d’un onglet ChatGPT connecté au même compte et au même espace de travail, avec le suivi local activé et la barre latérale ouverte. L’onglet peut rester en arrière-plan. Une conversation hors de la barre latérale, un chat temporaire ou un onglet suspendu peut retarder ou empêcher la remontée. La lecture depuis un autre appareil retire la ligne lorsque la source observée cesse de signaler le résultat comme non lu.

Les extensions 0.3.0 sont préparées pour la soumission. Le menu du collecteur affiche **Extension en attente de publication** tant que la fiche n’est pas renseignée pour ce navigateur. [Installation et publication](../../browser/README.md)

## Signalements à OpenAI

- Un tour actif sur ChatGPT Web peut être signalé comme inactif par l’application Windows jusqu’à sa fin. [openai/codex #61143](https://github.com/openai/codex/issues/61143)
- L’application Windows peut exposer l’état des conversations ChatGPT classiques plus tard et de façon moins régulière que celui des tâches Work et Codex. [openai/codex #61827](https://github.com/openai/codex/issues/61827)
