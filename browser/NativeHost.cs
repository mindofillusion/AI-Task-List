using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

internal static class NativeHost
{
    private const string HostName = "fr.pierrechevalier.ai_task_list";
    private const int MaxMessageBytes = 128 * 1024;

    private static int Main(string[] args)
    {
        if (!AuthorizedCaller(args)) return 2;

        string sources = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            "AI-Task-List", "sources");
        Directory.CreateDirectory(sources);
        string file = Path.Combine(sources, "chatgpt-web-" + Process.GetCurrentProcess().Id + ".json");
        var serializer = new JavaScriptSerializer { MaxJsonLength = MaxMessageBytes };
        var gate = new object();
        var tasks = new List<Dictionary<string, string>>();
        var utf8 = new UTF8Encoding(false);
        Action publish = delegate
        {
            string content = serializer.Serialize(new
            {
                schemaVersion = 1,
                updatedAt = (DateTime.UtcNow.Ticks - 621355968000000000L) / TimeSpan.TicksPerMillisecond,
                tasks = tasks
            });
            File.WriteAllText(file + ".tmp", content, utf8);
            if (File.Exists(file)) File.Replace(file + ".tmp", file, null);
            else File.Move(file + ".tmp", file);
        };

        try
        {
            using (var input = new BinaryReader(Console.OpenStandardInput(), utf8))
            using (var pulse = new Timer(delegate
            {
                lock (gate)
                {
                    if (tasks.Count == 0) return;
                    try { publish(); }
                    catch (IOException) { }
                    catch (UnauthorizedAccessException) { }
                }
            }, null, 5000, 5000))
            {
                while (true)
                {
                    byte[] header = input.ReadBytes(4);
                    if (header.Length == 0) return 0;
                    if (header.Length != 4) return 1;
                    int size = BitConverter.ToInt32(header, 0);
                    if (size < 1 || size > MaxMessageBytes) return 1;
                    byte[] value = input.ReadBytes(size);
                    if (value.Length != size) return 1;
                    var incoming = serializer.Deserialize<Payload>(utf8.GetString(value));
                    if (incoming == null || incoming.tasks == null || incoming.tasks.Length > 100) return 1;
                    lock (gate)
                    {
                        tasks.Clear();
                        foreach (Task row in incoming.tasks)
                        {
                            Guid id;
                            if (row == null || !Guid.TryParseExact(row.id, "D", out id)) continue;
                            if (row.state != "idle" && row.state != "inProgress" && row.state != "completedUnread")
                                continue;
                            if (row.state != "idle" && (String.IsNullOrWhiteSpace(row.title) || row.title.Length > 300))
                                continue;
                            var task = new Dictionary<string, string> { { "id", id.ToString() }, { "state", row.state } };
                            if (row.state != "idle") task.Add("title", row.title);
                            tasks.Add(task);
                        }
                        publish();
                    }
                }
            }
        }
        catch (ArgumentException) { return 1; }
        catch (InvalidOperationException) { return 1; }
        catch (IOException) { return 1; }
        catch (UnauthorizedAccessException) { return 1; }
        finally
        {
            lock (gate)
            {
                tasks.Clear();
                try { File.Delete(file); File.Delete(file + ".tmp"); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
    }

    private static bool AuthorizedCaller(string[] args)
    {
        if (args.Length == 0) return false;
        string directory = AppDomain.CurrentDomain.BaseDirectory;
        bool chromium = args[0].StartsWith("chrome-extension://", StringComparison.Ordinal);
        string manifest = Path.Combine(directory, HostName + (chromium ? ".json" : ".firefox.json"));
        try
        {
            var config = new JavaScriptSerializer().Deserialize<HostManifest>(File.ReadAllText(manifest));
            if (config == null || config.name != HostName) return false;
            if (chromium) return Array.IndexOf(config.allowed_origins ?? new string[0], args[0]) >= 0;
            return args.Length >= 2 &&
                String.Equals(Path.GetFullPath(args[0]), manifest, StringComparison.OrdinalIgnoreCase) &&
                Array.IndexOf(config.allowed_extensions ?? new string[0], args[1]) >= 0;
        }
        catch (ArgumentException) { return false; }
        catch (InvalidOperationException) { return false; }
        catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
    }

    public sealed class HostManifest
    {
        public string name { get; set; }
        public string[] allowed_origins { get; set; }
        public string[] allowed_extensions { get; set; }
    }

    public sealed class Payload { public Task[] tasks { get; set; } }
    public sealed class Task
    {
        public string id { get; set; }
        public string state { get; set; }
        public string title { get; set; }
    }
}
