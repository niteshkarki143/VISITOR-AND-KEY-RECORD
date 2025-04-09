@echo off
echo WARNING: This will delete ALL visitor records permanently!
echo.
set /p confirm="Are you sure you want to clear all records? (Y/N): "

if /i "%confirm%"=="Y" (
    echo Clearing visitor records...
    
    REM Clear visitors.json file
    if exist "n:\LOG BOOK\data\visitors.json" (
        echo Deleting visitors.json...
        echo [] > "n:\LOG BOOK\data\visitors.json"
    )
    
    REM Clear photos directory
    if exist "n:\LOG BOOK\data\photos" (
        echo Clearing photos directory...
        del /Q "n:\LOG BOOK\data\photos\*.*"
    )
    
    echo.
    echo All visitor records have been cleared.
) else (
    echo Operation cancelled. No records were deleted.
)

echo.
pause
