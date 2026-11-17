# ChatGPT Web pour AI Task List

L’extension lit les indicateurs de la barre latérale de ChatGPT et les transmet au collecteur Windows par la messagerie native du navigateur. Les seules données transmises sont l’identifiant, le titre et l’état des conversations en cours ou non lues. Lorsqu’une conversation suivie revient à l’état lu, le relais transmet son identifiant pour retirer l’entrée du widget.

## Installer sous Windows

Extrayez l’archive Windows d’**AI Task List 2.2.0** et lancez l’installation depuis PowerShell. Le script installe le collecteur, configure les navigateurs détectés pour le compte Windows courant et ouvre les fiches officielles renseignées dans `stores.json`. Si le collecteur est déjà installé, `-BrowserOnly` lance seulement la configuration des navigateurs.

```powershell
.\Setup-AI-Task-List.ps1
.\Setup-AI-Task-List.ps1 -BrowserOnly -Browser Brave
.\Setup-AI-Task-List.ps1 -BrowserOnly -Browser Firefox -WhatIf
```

Après l’installation, le même parcours est disponible dans Windows. Faites un clic droit sur l’icône **AI Task List Collector** près de l’horloge et choisissez **Installer l’extension ChatGPT Web**, puis le navigateur voulu. Cette commande prépare le relais et vous indique quand la fiche officielle est disponible.

| Navigateur | Installation de l’extension |
| --- | --- |
| Chrome | Chrome Web Store. L’option `-Browser Chrome -StageChrome` enregistre une extension publiée pour le prochain démarrage. Elle nécessite les droits administrateur et Chrome demande l’activation. |
| Brave, Vivaldi, Opera, Opera GX | Chrome Web Store. Le navigateur demande de confirmer l’ajout. |
| Edge | Microsoft Edge Add-ons. Le navigateur demande de confirmer l’ajout. |
| Firefox | Mozilla Add-ons. Le navigateur vérifie la signature et demande de confirmer l’ajout. Sur Firefox ESR, `-Browser Firefox -FirefoxEsrXpi chemin.xpi` permet de déployer un paquet signé via le dossier de distribution lorsqu’on a les droits d’écriture. |

`-ConfigureOnly` configure le relais sans ouvrir les boutiques. `-WhatIf` affiche les actions prévues. Pour un navigateur portable, utilisez `-Executable` avec l’installateur du dossier `browser`. Pour `-StageChrome` et `-FirefoxEsrXpi`, utilisez également cet installateur.

```powershell
.\browser\Install-ChatGPT-Web.ps1 -Browser Vivaldi -Executable 'D:\Applications\Vivaldi\vivaldi.exe'
```

Le parcours de la page web jusqu’au collecteur a été vérifié avec des profils isolés de Brave, Edge, Firefox et Chrome for Testing et une page locale simulant les trois états. Vivaldi, Opera et Opera GX restent à valider sur des installations réelles. Ce paquet cible Windows, où la version actuelle de Safari est indisponible.

## Publier l’extension

L’archive distincte `AI-Task-List-Web` fournit les paquets d’envoi. L’installateur Windows indique `AwaitingPublication` tant que la fiche du navigateur manque dans son fichier `browser/stores.json`.

| Portail éditeur | Fichier à envoyer | Champ de `stores.json` |
| --- | --- | --- |
| [Chrome Web Store](https://developer.chrome.com/docs/webstore/publish) | `chromium-store-upload.zip` | `chrome`. Identifiant de 32 caractères de la fiche. |
| [Microsoft Partner Center](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension) | `chromium-store-upload.zip` | `edge`. Identifiant de 32 caractères de la fiche. |
| [Mozilla Add-ons](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) | `firefox-signing-upload.zip` | `firefox`. Dernier segment de l’URL de la fiche, entre `/addon/` et le dernier `/`. |

Après validation par les boutiques, renseignez ces champs dans `browser/stores.json` du dépôt, puis reconstruisez l’archive Windows avec `build.ps1`. Pour tester une fiche avant de reconstruire, utilisez `-ChromeStoreId`, `-EdgeStoreId` ou `-FirefoxStoreSlug` avec `Install-ChatGPT-Web.ps1`. Les comptes éditeur servent à la publication. Les utilisateurs installent l’extension depuis leur navigateur.

Le [guide de publication](PUBLICATION.md) contient les textes des fiches, les déclarations de données et la note destinée aux évaluateurs. La [politique de confidentialité](../PRIVACY.md) décrit le traitement et la suppression des données sur le PC.

## Vérifier le suivi

Ouvrez le panneau de l’extension et choisissez **Activer le suivi local**. Le suivi démarre désactivé dans chaque profil. Ouvrez ChatGPT sur le PC du XENEON EDGE dans ce profil. Gardez un onglet connecté et sa barre latérale ouverte. L’onglet peut rester en arrière-plan. Sur l’autre appareil, avec le même compte et le même espace de travail, lancez une demande. Comparez le marqueur de la barre latérale avec la ligne du widget, puis vérifiez les états terminé et lu. Le bouton **Désactiver le suivi local** interrompt le suivi et vide le panneau.

Le relais dépend des marqueurs rendus dans cet onglet. Les conversations absentes de la barre latérale, les chats temporaires et les onglets suspendus peuvent limiter la détection. Le navigateur transmet le titre et l’état. Au besoin, le collecteur complète ces champs avec les métadonnées déjà disponibles localement.

La [page des limites d’affichage](../docs/fr/limitations.md) détaille les champs par source et donne les liens vers les signalements à OpenAI.

## Désinstaller

Retirez **AI Task List – ChatGPT Web** de la page Extensions de votre navigateur. Exécutez `.\Install-ChatGPT-Web.ps1 -Uninstall` pour retirer le relais local et ses enregistrements. Si vous avez ajouté l’extension par le registre Chrome ou par le dossier de distribution Firefox ESR, retirez aussi l’entrée de déploiement correspondante.

- [Déploiement externe des extensions Chrome](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)
- [Extensions dans Brave](https://support.brave.app/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave)
- [Extensions dans Vivaldi](https://help.vivaldi.com/desktop/appearance-customization/extensions/)
- [Extensions dans Opera](https://help.opera.com/en/faq/)
- [Options de distribution des extensions Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/alternate-distribution-options)
- [Signature des extensions Firefox](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Déploiement Firefox ESR](https://support.mozilla.org/en-US/kb/deploying-firefox-with-extensions)
