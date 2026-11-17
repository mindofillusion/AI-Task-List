[English](README.md) | **Français**

# AI Task List pour iCUE

AI Task List affiche les tâches en cours et les résultats non lus des assistants IA sur le CORSAIR XENEON EDGE. Codex, Work et ChatGPT sont pris en charge par l’adaptateur intégré lorsque leur état est visible dans l’application de bureau. D’autres clients peuvent publier leurs propres tâches selon le [format JSON documenté](docs/fr/providers.md).

La ligne grise indique l’activité, le numéro du tour et sa durée. Le grand chrono reprend le temps de l’objectif lorsqu’il existe, ou le cumul de traitement de la dernière demande. Une tâche terminée reste visible jusqu’à ce que sa source cesse de la signaler comme non lue. Une ligne fixe sous la liste affiche les pourcentages du quota Codex / Work renvoyés pour le compte connecté.

<img width="845" height="354" alt="image" src="https://github.com/user-attachments/assets/129c2cc7-db78-4abd-9285-db86a49ec94b" /> <img width="845" height="349" alt="image" src="https://github.com/user-attachments/assets/25e46e2f-986c-4d89-8ed1-597afdc07f4d" />

## Téléchargements

- [AI Task List 2.2.0 pour iCUE](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-2.2.0.icuewidget)
- [Collecteur et widget 2.2.0 pour Windows, préversion non signée](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-2.2.0-windows-unsigned-preview.zip)
- [Guide d’installation et d’utilisation du widget](docs/fr/widget.md) et [limites d’affichage et tickets OpenAI](docs/fr/limitations.md)
- [Guide ChatGPT Web](browser/README.md), [politique de confidentialité](PRIVACY.md#politique-de-confidentialité) et [dossier de soumission aux boutiques](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/AI-Task-List-Web-0.3.0-publication.zip)
- [Historique des versions](CHANGELOG.md)
- [Empreintes SHA-256](https://raw.githubusercontent.com/mindofillusion/AI-Task-List/main/downloads/SHA256SUMS-2.2.0.txt)

Le fichier `.icuewidget` s’importe directement dans iCUE. Pour alimenter l’affichage, démarrez le collecteur ou fournissez un fichier compatible au chemin indiqué dans le guide.

## Installer sous Windows

Il faut iCUE 5.52 ou ultérieur et un XENEON EDGE. Pour suivre Codex, ouvrez l’application de bureau sous le même compte Windows. Le paquet contient le binaire officiel Node.js et les scripts du collecteur.

1. Extrayez l’archive Windows dans un dossier et vérifiez les signatures de l’installateur et du collecteur avec PowerShell.

   ```powershell
   Get-AuthenticodeSignature .\Setup-AI-Task-List.ps1, .\Install-AI-Task-Collector.ps1, .\app\AI-Task-Collector.exe, .\app\node.exe, .\browser\Install-ChatGPT-Web.ps1, .\browser\AI-Task-List-Web.exe
   ```

   Une distribution signée doit indiquer `Valid` pour chaque fichier. Le binaire Node.js porte la signature de l’OpenJS Foundation. Les archives nommées `unsigned-preview` contiennent des scripts et des exécutables du projet sans signature.

2. Dans PowerShell, exécutez `.\Setup-AI-Task-List.ps1`. Le collecteur démarre pour le compte courant et se relance à l’ouverture de session si Windows permet de créer le raccourci de démarrage. L’installateur configure le relais ChatGPT Web pour les navigateurs détectés et ouvre les fiches des extensions publiées. Confirmez leur ajout dans le navigateur. Ajoutez `-Browser Brave` pour cibler un seul navigateur, `-SkipBrowser` pour installer uniquement le collecteur ou `-WhatIf` pour prévisualiser les actions. Le [guide ChatGPT Web](browser/README.md) décrit aussi l’installation dans un navigateur portable.
3. Importez le fichier `.icuewidget` inclus dans iCUE. Autorisez l’accès à `<Home>/AI-Task-List/tasks.json` lorsque iCUE le demande, puis ajoutez **AI Task List** à votre écran. Le widget 2.1.0 déjà importé peut lire les données du nouveau collecteur.

Le widget se rafraîchit à la prochaine mise à jour du fichier. Si le collecteur est indisponible, vérifiez la date de modification de `%USERPROFILE%\AI-Task-List\tasks.json` et l’autorisation de fichier dans iCUE.

À partir du collecteur 2.1.1, l’icône **AI Task List Collector** se trouve dans la zone de notification Windows. Son menu permet de redémarrer ou de quitter le collecteur. L’application relance la collecte au réveil de Windows et lorsque le fichier cesse d’être mis à jour. Une réorientation pendant un tour laisse le chrono de la demande continuer. Le widget 2.1.0 déjà installé peut lire ces mises à jour.

Pour ajouter le suivi de ChatGPT Web après installation, faites un clic droit sur l’icône du collecteur et choisissez **Installer l’extension ChatGPT Web**, puis votre navigateur ou **Tous les navigateurs détectés**. Une boîte de dialogue indique pour chacun si la fiche est ouverte ou si l’extension est encore en attente de publication. Les paquets de soumission 0.3.0 sont disponibles. Le menu pourra ouvrir les fiches après leur approbation et l’ajout de leurs identifiants au catalogue de l’installateur.

L’application de bureau peut afficher une conversation ChatGPT comme active alors que cette activité est absente du catalogue local. Le widget l’affiche lorsque le collecteur reçoit un état actif ou non lu qu’il sait interpréter.

Pour désinstaller le collecteur, exécutez `.\Install-AI-Task-Collector.ps1 -Uninstall`. Les fichiers des fournisseurs sont conservés dans `sources`. Retirez ensuite le widget de l’écran iCUE.

## Clients détectés et localisation

Lorsque la liste est vide, le widget distingue un client ouvert sans tâche d’une machine sur laquelle aucun client de bureau configuré ne tourne. Les tâches et résultats non lus restent prioritaires. La configuration se trouve dans `%LOCALAPPDATA%\AI-Task-List\app\clients.json` après installation. Chaque entrée contient un identifiant, un libellé et les noms de processus Windows correspondants ; ChatGPT / Codex Desktop (`ChatGPT.exe`) est fourni par défaut. Ajoutez une entrée au tableau `clients`, puis redémarrez le collecteur pour prendre en charge un autre client lourd.

L’interface suit la langue fournie par iCUE. L’anglais et le français sont inclus dans `widget\translation.json`. Pour ajouter une traduction, dupliquez l’objet `en`, remplacez son code de langue et traduisez les valeurs sans modifier les clés. Le build refuse une langue incomplète. Si le service de traduction iCUE est absent, le français est utilisé pour une locale française et l’anglais dans les autres cas.

## Données et permissions

Le collecteur s’exécute avec les droits du compte Windows courant. L’adaptateur Codex ouvre le catalogue et les bases SQLite en lecture seule. Toutes les cinq minutes, il interroge aussi le service de quotas via le serveur d’application de Codex, qui utilise la connexion au compte existante. Le fichier de sortie contient les identifiants et titres des tâches, leurs états, leur provenance, le modèle, l’effort, les chronos et les compteurs de quota disponibles. Le widget dispose d’une permission pour ce fichier précis. La collecte des tâches reste locale. La lecture du quota utilise la connexion réseau de Codex. Le collecteur et le widget fonctionnent sans port d’écoute ni clé API supplémentaire.

## Construire et signer

La construction nécessite le binaire Windows officiel de Node.js 26 ou ultérieur, le compilateur C# du .NET Framework et le CLI Corsair `icuewidget` dans le PATH. Avec le CLI 0.5 ou ultérieur, la validation couvre aussi les permissions. Le build valide le widget, exécute les tests et place les fichiers dans `dist/`. Il joint la licence de la version de Node.js utilisée. Pour fournir cette licence depuis un fichier local, utilisez le paramètre `-NodeLicense`.

```powershell
.\build.ps1
.\build.ps1 -SigningThumbprint 'EMPREINTE_DU_CERTIFICAT'
```

La seconde commande nécessite un certificat de signature de code approuvé par Windows dans le magasin personnel de l’utilisateur et sa clé privée. Le build vérifie la signature officielle de Node.js, signe les exécutables et les installateurs du projet, et inscrit les SHA-256 des fichiers du collecteur. Une erreur de signature interrompt le build signé. Le build produit aussi une archive séparée contenant les paquets d’extension à soumettre aux boutiques.

- [Plugin File System d’iCUE](https://docs.elgato.com/icue/widgets/references/plugins/file-system-provider/)
- [Créer un paquet iCUE](https://docs.elgato.com/icue/widgets/)
- [Signature Authenticode dans PowerShell](https://learn.microsoft.com/powershell/module/microsoft.powershell.security/set-authenticodesignature)
