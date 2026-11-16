
using AssetTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AssetTracker.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Asset> Assets => Set<Asset>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Asset>()
            .HasIndex(a => a.Tag)
            .IsUnique();
    }
}
