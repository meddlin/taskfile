; Inno Setup script for the Windows installer. Compiled by package-windows.ts, which passes:
;   /DAppVersion=<semver>  /DSourceDir=<staged tree>  /DOutputDir=<dir>  /DOutputBaseFilename=<name>
;
; Installs per-user (no admin prompt) into %LOCALAPPDATA%\Programs\taskfile and adds that folder
; to the user's PATH so `taskfile` works from any new terminal.

#ifndef AppVersion
  #error AppVersion must be defined (/DAppVersion=x.y.z)
#endif

[Setup]
AppId={{03D19193-172C-44EF-BCFF-6F2234DAFA36}
AppName=taskfile
AppVersion={#AppVersion}
AppPublisher=Rushing Labs
AppPublisherURL=https://github.com/meddlin/taskfile
DefaultDirName={autopf}\taskfile
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesEnvironment=yes
LicenseFile={#SourceDir}\LICENSE
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=taskfile {#AppVersion}

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Registry]
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Check: NeedsAddPath(ExpandConstant('{app}'))

[Code]
// Case-insensitive check for `Dir` as a whole entry of a semicolon-separated PATH value.
function PathContains(Path, Dir: string): Boolean;
begin
  Result := Pos(';' + Uppercase(Dir) + ';', ';' + Uppercase(Path) + ';') > 0;
end;

function NeedsAddPath(Dir: string): Boolean;
var
  Path: string;
begin
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', Path) then
    Result := True
  else
    Result := not PathContains(Path, Dir);
end;

procedure RemoveFromPath(Dir: string);
var
  Path, Padded: string;
  P: Integer;
begin
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', Path) then
    exit;
  Padded := ';' + Path + ';';
  P := Pos(';' + Uppercase(Dir) + ';', Uppercase(Padded));
  if P = 0 then
    exit;
  // Drop ";Dir", leaving the trailing ';' so adjacent entries stay separated.
  Delete(Padded, P, Length(Dir) + 1);
  if Length(Padded) > 2 then
    Path := Copy(Padded, 2, Length(Padded) - 2)
  else
    Path := '';
  RegWriteExpandStringValue(HKCU, 'Environment', 'Path', Path);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    RemoveFromPath(ExpandConstant('{app}'));
end;
