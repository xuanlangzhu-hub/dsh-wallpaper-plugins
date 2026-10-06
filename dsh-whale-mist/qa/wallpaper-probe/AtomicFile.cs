static class AtomicFile
{
    public static async Task<bool> Publish(string path, byte[] bytes)
    {
        var temporary = path + ".tmp";
        await File.WriteAllBytesAsync(temporary, bytes);
        for (int attempt = 0; attempt < 3; attempt++)
        {
            try { File.Move(temporary, path, true); return true; }
            catch (IOException) { if (attempt < 2) await Task.Delay(5); }
            catch (UnauthorizedAccessException) { if (attempt < 2) await Task.Delay(5); }
        }
        // Keep the last complete frame; the next publication replaces this temporary file.
        return false;
    }

    public static async Task SelfTest(string directory)
    {
        Directory.CreateDirectory(directory);
        var file = Path.Combine(directory, "locked-publish-test.jpg");
        if (File.Exists(file)) throw new IOException("Use a new self-test directory.");
        await File.WriteAllBytesAsync(file, [1, 2, 3]);
        using (var reader = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            if (await Publish(file, [4, 5, 6])) throw new Exception("Locked destination unexpectedly replaced.");
            if (reader.ReadByte() != 1) throw new Exception("Existing frame damaged.");
        }
        if (!await Publish(file, [4, 5, 6])) throw new Exception("Publication failed after reader closed.");
        if (!(await File.ReadAllBytesAsync(file)).SequenceEqual(new byte[] { 4, 5, 6 })) throw new Exception("New frame incorrect.");
        Console.WriteLine("PASS: locked frame preserved; publishing recovers after release.");
    }
}
