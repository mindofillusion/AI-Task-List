using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("AI Task List Collector")]
[assembly: AssemblyProduct("AI Task List")]
[assembly: AssemblyVersion("2.2.0.0")]

internal static class Program
{
    private const string InstanceName = "Local\\AI-Task-List-Collector";
    private const string StopName = InstanceName + "-Stop";

    [STAThread]
    private static int Main(string[] args)
    {
        if (Array.IndexOf(args, "--stop") >= 0)
        {
            try
            {
                using (var stop = EventWaitHandle.OpenExisting(StopName)) stop.Set();
                using (var instance = Mutex.OpenExisting(InstanceName))
                {
                    try
                    {
                        if (!instance.WaitOne(8000)) return 1;
                    }
                    catch (AbandonedMutexException) { }
                    instance.ReleaseMutex();
                }
            }
            catch (WaitHandleCannotBeOpenedException) { }
            return 0;
        }

        bool noCodex = Array.IndexOf(args, "--no-codex") >= 0;
        if (Array.IndexOf(args, "--once") >= 0)
        {
            using (var worker = CollectorTray.StartWorker(noCodex, true))
            {
                if (worker.WaitForExit(25000)) return worker.ExitCode;
                worker.Kill();
                return 1;
            }
        }

        bool ownsInstance;
        using (var instance = new Mutex(true, InstanceName, out ownsInstance))
        {
            if (!ownsInstance) return 0;
            try
            {
                Application.EnableVisualStyles();
                using (var stop = new EventWaitHandle(false, EventResetMode.AutoReset, StopName))
                using (var tray = new CollectorTray(noCodex, stop))
                {
                    Application.Run(tray);
                }
            }
            finally
            {
                instance.ReleaseMutex();
            }
        }
        return 0;
    }
}

internal sealed class CollectorTray : ApplicationContext
{
    private const string Name = "AI Task List Collector";
    private static readonly TimeSpan SnapshotTimeout = TimeSpan.FromSeconds(20);
    private readonly bool noCodex;
    private readonly bool french = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "fr";
    private readonly EventWaitHandle stop;
    private readonly NotifyIcon icon;
    private readonly Icon image;
    private readonly ContextMenuStrip menu;
    private readonly ToolStripMenuItem browserMenu;
    private readonly System.Windows.Forms.Timer timer;
    private readonly PowerWindow powerWindow;
    private readonly Stopwatch sinceStart = Stopwatch.StartNew();
    private readonly string snapshot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "AI-Task-List", "tasks.json");
    private Process worker;
    private DateTime? restartAfterWake;

    internal CollectorTray(bool noCodex, EventWaitHandle stop)
    {
        this.noCodex = noCodex;
        this.stop = stop;
        menu = new ContextMenuStrip();
        browserMenu = new ToolStripMenuItem(french ? "Installer l’extension ChatGPT Web" : "Install ChatGPT Web extension");
        AddBrowserOption("Auto", french ? "Tous les navigateurs détectés" : "All detected browsers");
        browserMenu.DropDownItems.Add(new ToolStripSeparator());
        AddBrowserOption("Brave", "Brave");
        AddBrowserOption("Chrome", "Chrome");
        AddBrowserOption("Edge", "Edge");
        AddBrowserOption("Firefox", "Firefox");
        AddBrowserOption("Vivaldi", "Vivaldi");
        AddBrowserOption("Opera", "Opera");
        AddBrowserOption("OperaGX", "Opera GX");
        menu.Items.Add(browserMenu);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(french ? "Redémarrer le collecteur" : "Restart collector", null,
            delegate { RestartWorker(); });
        menu.Items.Add(french ? "Quitter" : "Exit", null, delegate { ExitThread(); });
        using (Stream resource = typeof(CollectorTray).Assembly.GetManifestResourceStream("Collector.ico"))
        {
            if (resource != null) image = new Icon(resource, SystemInformation.SmallIconSize);
        }
        icon = new NotifyIcon
        {
            Icon = image ?? SystemIcons.Application,
            Text = Name,
            ContextMenuStrip = menu,
            Visible = true
        };
        powerWindow = new PowerWindow(delegate { restartAfterWake = DateTime.UtcNow.AddSeconds(3); });
        timer = new System.Windows.Forms.Timer { Interval = 1000 };
        timer.Tick += CheckWorker;
        RestartWorker();
        timer.Start();
    }

    private void AddBrowserOption(string id, string label)
    {
        browserMenu.DropDownItems.Add(label, null, async delegate { await InstallBrowserExtension(id); });
    }

    private async Task InstallBrowserExtension(string browser)
    {
        browserMenu.Enabled = false;
        try
        {
            var results = await Task.Run(() => RunBrowserSetup(browser));
            var lines = new System.Collections.Generic.List<string>();
            bool openedStore = false;
            foreach (var result in results)
            {
                string label = result.Browser == "OperaGX" ? "Opera GX" : result.Browser;
                string status;
                switch (result.Extension)
                {
                    case "BrowserNotFound":
                        status = french ? "navigateur introuvable" : "browser not found";
                        break;
                    case "AwaitingBrowserConfirmation":
                        status = french ? "fiche ouverte. Confirmez l’ajout dans le navigateur." :
                            "store page opened. Confirm the installation in the browser.";
                        openedStore = true;
                        break;
                    default:
                        status = french ? "relais configuré. Extension en attente de publication." :
                            "relay configured. The extension is awaiting publication.";
                        break;
                }
                lines.Add(label + " — " + status);
            }
            if (results.Length == 0)
                lines.Add(french ? "Aucun navigateur compatible détecté." : "No supported browser was detected.");
            if (openedStore)
            {
                lines.Add("");
                lines.Add(french ? "Après l’ajout, activez le suivi local dans l’extension. Gardez un onglet ChatGPT connecté avec sa barre latérale ouverte." :
                    "After installation, enable local tracking in the extension. Keep a signed-in ChatGPT tab open with its sidebar visible.");
            }
            MessageBox.Show(string.Join(Environment.NewLine, lines), Name, MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception error)
        {
            string caption = french ? "Installation de l’extension impossible" : "Extension setup failed";
            MessageBox.Show(error.Message, caption, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            browserMenu.Enabled = true;
        }
    }

    private static BrowserInstallResult[] RunBrowserSetup(string browser)
    {
        string appDirectory = Path.GetDirectoryName(typeof(CollectorTray).Assembly.Location);
        string directory = Path.GetFullPath(Path.Combine(appDirectory, "..", "browser-setup"));
        string script = Path.Combine(directory, "Install-ChatGPT-Web.ps1");
        var options = new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe"),
            Arguments = "-NoProfile -NonInteractive -File \"" + script + "\" -Browser " + browser +
                " -ReportJson -WarningAction SilentlyContinue",
            WorkingDirectory = directory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        // Windows PowerShell must resolve its own modules when started from another PowerShell edition.
        options.EnvironmentVariables.Remove("PSModulePath");
        using (var process = Process.Start(options))
        {
            var output = process.StandardOutput.ReadToEndAsync();
            var errors = process.StandardError.ReadToEndAsync();
            process.WaitForExit();
            if (process.ExitCode != 0)
                throw new InvalidOperationException(errors.GetAwaiter().GetResult().Trim());
            return new JavaScriptSerializer().Deserialize<BrowserInstallResult[]>(output.GetAwaiter().GetResult());
        }
    }

    public sealed class BrowserInstallResult
    {
        public string Browser { get; set; }
        public string Extension { get; set; }
    }

    internal static Process StartWorker(bool noCodex, bool once)
    {
        string directory = AppDomain.CurrentDomain.BaseDirectory;
        return Process.Start(new ProcessStartInfo
        {
            FileName = Path.Combine(directory, "node.exe"),
            Arguments = "\"" + Path.Combine(directory, "main.cjs") + "\"" +
                (noCodex ? " --no-codex" : "") + (once ? " --once" : " --supervised"),
            WorkingDirectory = directory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = !once
        });
    }

    private void CheckWorker(object sender, EventArgs args)
    {
        if (stop.WaitOne(0))
        {
            ExitThread();
            return;
        }
        var now = DateTime.UtcNow;
        if (restartAfterWake.HasValue)
        {
            if (now >= restartAfterWake.Value)
            {
                restartAfterWake = null;
                RestartWorker();
            }
            return;
        }
        if (worker == null || worker.HasExited)
        {
            if (sinceStart.Elapsed.TotalSeconds >= 5) RestartWorker();
            return;
        }
        if (sinceStart.Elapsed >= SnapshotTimeout)
        {
            var age = now - File.GetLastWriteTimeUtc(snapshot);
            if (age > SnapshotTimeout || age < -SnapshotTimeout) RestartWorker();
        }
    }

    private void RestartWorker()
    {
        StopWorker();
        sinceStart.Restart();
        try { worker = StartWorker(noCodex, false); }
        catch (Win32Exception) { }
    }

    private void StopWorker()
    {
        if (worker == null) return;
        try
        {
            if (!worker.HasExited)
            {
                try { worker.StandardInput.Close(); }
                catch (IOException) { }
                if (!worker.WaitForExit(1500))
                {
                    worker.Kill();
                    worker.WaitForExit(1500);
                }
            }
        }
        catch (InvalidOperationException) { }
        catch (Win32Exception) { }
        finally
        {
            worker.Dispose();
            worker = null;
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            timer.Dispose();
            powerWindow.DestroyHandle();
            icon.Visible = false;
            icon.Dispose();
            if (image != null) image.Dispose();
            menu.Dispose();
            StopWorker();
        }
        base.Dispose(disposing);
    }

    private sealed class PowerWindow : NativeWindow
    {
        private readonly Action resume;

        internal PowerWindow(Action resume)
        {
            this.resume = resume;
            // A hidden top-level HWND receives the Windows power broadcast.
            CreateHandle(new CreateParams { Caption = Name + " Power Events" });
        }

        protected override void WndProc(ref Message message)
        {
            const int PowerBroadcast = 0x0218;
            const int ResumeAutomatic = 0x0012;
            if (message.Msg == PowerBroadcast && message.WParam.ToInt32() == ResumeAutomatic)
                resume();
            base.WndProc(ref message);
        }
    }
}
