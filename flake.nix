# Run `nix develop` to get a shell with the prisma CLI
# reference: https://github.com/VanCoding/nix-prisma-utils

{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    prisma-utils.url = "github:VanCoding/nix-prisma-utils";
  };

  outputs =
    { nixpkgs, prisma-utils, ... }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      prisma =
        (prisma-utils.lib.prisma-factory {
          inherit pkgs;
          # just copy these hashes for now, and then change them when nix complains about the mismatch
          prisma-fmt-hash = "sha256-atD5GZfmeU86mF1V6flAshxg4fFR2ews7EwaJWZZzbc=";
          query-engine-hash = "sha256-8FTZaKmQCf9lrDQvkF5yWPeZ7TSVfFjTbjdbWWEHgq4=";
          libquery-engine-hash = "sha256-USIdaum87ekGY6F6DaL/tKH0BAZvHBDK7zjmCLo//kM=";
          schema-engine-hash = "sha256-k5MkxXViEqojbkkcW/4iBFNdfhb9PlMEF1M2dyhfOok=";
        }).fromNpmLock
          ./package-lock.json; # <--- path to our package-lock.json file that contains the version of prisma-engines
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        env = prisma.env;
        # or, you can use `shellHook` instead of `env` to load the same environment variables.
        # shellHook = prisma.shellHook;
      };
    };
}

