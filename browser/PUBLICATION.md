# Publier AI Task List – ChatGPT Web 0.3.0

Le nom affiché dans les trois boutiques est **AI Task List – ChatGPT Web**. Le public visé utilise le collecteur Windows et le widget iCUE sur un CORSAIR XENEON EDGE. Les visuels du dossier de soumission montrent une démonstration réalisée avec des données fictives.

## Mettre le collecteur à disposition des évaluateurs

Indiquez aux évaluateurs le [téléchargement de la préversion Windows 2.2.0](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-2.2.0-windows-unsigned-preview.zip) et le [guide d’installation](README.md). Cette archive est une préversion non signée. Le build accepte un certificat de signature de code Windows avec `-SigningThumbprint`. La signature du collecteur est distincte de la signature de l’extension que réalise la boutique.

Le lien de confidentialité prévu est [PRIVACY.md sur le dépôt public](https://github.com/mindofillusion/AI-Task-List/blob/main/PRIVACY.md). Vérifiez que cette page et le téléchargement Windows sont accessibles sans connexion avant de transmettre les fiches. Utilisez la [page Issues](https://github.com/mindofillusion/AI-Task-List/issues) comme adresse d’assistance.

## Fichiers et portails

| Boutique | Paquet | Visuels à joindre |
| --- | --- | --- |
| [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) | `chromium-store-upload.zip` | `icon-128.png`, `tracking-1280x800.png` et, si le formulaire le demande, `promo-440x280.png`. |
| [Microsoft Edge Add-ons dans Partner Center](https://developer.microsoft.com/en-us/microsoft-edge/extensions/) | `chromium-store-upload.zip` | `icon-300.png`. La capture et la vignette promotionnelle sont également fournies. |
| [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/developers/) | `firefox-signing-upload.zip` | `icon-128.png` et `tracking-1280x800.png`. Sélectionnez **On this site** pour obtenir une fiche AMO publique et des mises à jour depuis la boutique. |

Un compte éditeur est nécessaire sur chaque portail. Utilisez la catégorie **Productivité** ou son équivalent disponible dans le formulaire. Ce dossier couvre les trois boutiques utilisées par l’installateur. Brave, Vivaldi, Opera et Opera GX utilisent la fiche du Chrome Web Store. [Fiche Chrome](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [fiche Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), [soumission Mozilla](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/).

## Texte des fiches

### English · United States

AI Task List shows which ChatGPT conversations are in progress and which have an unread result. Open the extension panel to check the list in your browser, or pair it with the AI Task List Collector on Windows to see those states in the iCUE widget on a CORSAIR XENEON EDGE.

Install the extension, then select **Enable local tracking** on its setup page. Keep a signed-in ChatGPT tab open with the sidebar visible. It can stay in the background. When activity from another device appears in that sidebar, the extension can reflect it in the list.

The extension reads only the conversation identifiers, titles and activity indicators visible in the ChatGPT sidebar. The AI Task List Collector receives them on the same PC. The publisher receives no conversation data. You can turn off tracking at any time in the extension panel. The Windows collector and iCUE widget are separate downloads.

### Français · France

AI Task List affiche les conversations ChatGPT en cours et celles dont la réponse reste à lire. Consultez la liste dans le panneau du navigateur ou associez l’extension au collecteur AI Task List pour l’afficher dans le widget iCUE de votre CORSAIR XENEON EDGE.

Après l’installation, choisissez **Activer le suivi local**. Gardez ensuite un onglet ChatGPT connecté, avec sa barre latérale ouverte. Il peut rester en arrière-plan. Si l’activité lancée sur un autre appareil apparaît dans cette barre, l’extension peut la reprendre.

L’extension lit les identifiants, les titres et les indicateurs d’activité visibles dans la barre latérale. Le collecteur les reçoit sur le même PC Windows. L’éditeur ne reçoit aucune donnée de conversation. Vous pouvez désactiver le suivi depuis le panneau à tout moment. Le collecteur Windows et le widget iCUE se téléchargent séparément.

## Champs de confidentialité

Copiez les réponses ci-dessous dans les rubriques correspondantes de Chrome et Edge. La déclaration du fichier Firefox indique `websiteContent`, car les données visibles sur le site sont transmises au programme local. Les titres peuvent contenir du texte propre à l’utilisateur et doivent être déclarés comme contenu du site même si le traitement demeure sur le PC. Si le portail distingue l’activité sur le site du contenu affiché, mentionnez aussi les indicateurs de génération et de lecture dans l’explication. [Déclaration Chrome](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [données traitées localement](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [taxonomie Mozilla](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

| Champ | Réponse à utiliser |
| --- | --- |
| Single purpose | Display the in-progress and unread states of visible ChatGPT conversations in the extension panel and send the same limited activity data to the local AI Task List Collector for iCUE. |
| Host access | Access to `https://chatgpt.com/*` is used to read the conversation title, identifier and activity marker shown in the sidebar. Tracking starts only after the user enables it in the extension. |
| `nativeMessaging` | Sends the visible activity indicators, conversation identifiers and titles to the AI Task List native relay on the same PC. This lets the iCUE widget display the task states. |
| `storage` | Saves the user’s tracking preference in local extension storage. Conversation identifiers, titles and states are never written to browser extension storage. |
| Remote code | No. All extension scripts are included in the uploaded archive. |
| User data | Website content from the ChatGPT sidebar. The data is used for the extension panel and local widget, with no remote synchronization, analytics, advertising or sale by the publisher. |
| Privacy Policy URL | `https://github.com/mindofillusion/AI-Task-List/blob/main/PRIVACY.md` after the page is public. |

## Note de certification à transmettre

> Install the extension and open its setup page or toolbar panel. Tracking starts off. Select **Enable local tracking** and open a signed-in ChatGPT tab. Keep its sidebar visible. Start a new conversation and wait for the sidebar to display its generating marker. The panel should show the conversation title and state. To check an unread completion, leave the conversation while it generates and return to it after completion to mark the result as read. The panel can reflect these transitions when ChatGPT displays the corresponding sidebar indicators. Selecting **Disable local tracking** clears the panel and stops the relay.
>
> The browser panel works without the Windows collector or an iCUE device. To test the integration on Windows, download AI Task List Collector 2.2.0 or later from the project README, then configure the native host for this extension’s store ID. The collector exposes the latest local state at `%USERPROFILE%\AI-Task-List\tasks.json` for the iCUE widget. The companion is optional for previewing the panel and required only for displaying the list in iCUE. Source files are plain JavaScript plus the separately distributed Windows companion.

Pour une recension avant publication de la fiche, joignez également l’identifiant attribué au brouillon Chrome ou Edge et la commande de test de l’installateur ci-dessous. Firefox utilise un identifiant stable dans son manifeste. Le navigateur et le collecteur n’exigent aucun compte développeur côté utilisateur.

## Relier les fiches au menu du collecteur

1. Après validation, ouvrez chaque fiche de boutique sans compte éditeur. Relevez l’identifiant Chrome et Edge de 32 lettres et le slug Mozilla, dernier segment de l’URL après `/addon/`.
2. Renseignez `chrome`, `edge` et `firefox` dans `browser/stores.json` à la racine du dépôt. Les fiches peuvent être activées progressivement. Conservez `null` pour les boutiques encore en attente. Exécutez `.\build.ps1` pour reconstruire l’archive Windows. L’installateur copie le catalogue dans le dossier utilisé par le menu du collecteur.
3. Installez le paquet Windows depuis l’archive reconstruite. Dans le menu **Installer l’extension ChatGPT Web**, choisissez le navigateur. La fiche correspondante doit s’ouvrir. Confirmez l’ajout dans le navigateur, activez le suivi et vérifiez le passage **En cours**, **Terminé, non lu**, puis la disparition après lecture. Pour le premier essai réel, utilisez une conversation sans données personnelles.

Pour tester les identifiants Chromium avec un installateur déjà extrait, depuis le dossier Windows, utilisez la commande adaptée. Remplacez chaque variable par l’identifiant fourni par la boutique avant de lancer la commande.

```powershell
.\browser\Install-ChatGPT-Web.ps1 -Browser Chrome -ChromeStoreId $chromeId -EdgeStoreId $edgeId -ConfigureOnly
.\browser\Install-ChatGPT-Web.ps1 -Browser Edge -ChromeStoreId $chromeId -EdgeStoreId $edgeId -ConfigureOnly
.\browser\Install-ChatGPT-Web.ps1 -Browser Firefox -FirefoxStoreSlug $firefoxSlug -ConfigureOnly
```

Si un seul identifiant Chromium est connu, passez uniquement le paramètre correspondant. `-ConfigureOnly` prépare la messagerie locale sans ouvrir la fiche. L’identifiant Firefox du fichier XPI reste `ai-task-list-web@pierrechevalier.fr`. Le slug sert seulement à ouvrir la boutique.
