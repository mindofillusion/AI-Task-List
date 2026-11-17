# Historique des versions

## AI Task List 2.2.0

- Le collecteur apparaît dans la zone de notification Windows, avec une icône contrastée. Il redémarre le travail de collecte au réveil ou lorsque le fichier d’état cesse de se mettre à jour. Son menu permet aussi de le redémarrer manuellement.
- Le menu prépare le relais de ChatGPT Web pour le navigateur sélectionné ou pour tous les navigateurs détectés. Il ouvre la fiche officielle lorsqu’elle est renseignée dans le catalogue et signale les fiches en attente.
- L’archive Windows réunit le collecteur, le widget et la configuration du navigateur. Le widget 2.1.0 déjà importé peut lire le nouveau fichier d’état.
- Une réorientation pendant une demande conserve le compteur de cette demande. Le widget continue d’afficher le temps de l’objectif lorsqu’il est disponible.

## Extension ChatGPT Web 0.3.0

- Le suivi local se commande dans le panneau de l’extension et reste désactivé avant le premier accord. Le panneau affiche les états visibles dans la barre latérale de ChatGPT.
- L’extension envoie les identifiants, titres et états au collecteur Windows par messagerie native. Elle exclut les fenêtres privées. Le suivi d’une conversation distante dépend de ce que le navigateur connecté affiche.
- Les paquets et les visuels de soumission sont prêts pour Chrome Web Store, Edge Add-ons et Mozilla Add-ons. L’activation depuis le menu dépend de la validation des fiches et de l’ajout de leurs identifiants.

[Installation Windows](README.fr.md#installer-sous-windows) · [Guide du widget](docs/fr/widget.md) · [Publication de l’extension](browser/PUBLICATION.md) · [Confidentialité](PRIVACY.md)
