$LocalFile = if ($args.Count -gt 0) { $args[0] } else { "data.json" }
$HdfsDir = "/dbt-data"
$HdfsFile = "data.json"
$Container = "dbt_hadoop_namenode"

Write-Host "--------------------------------------------------------"
Write-Host "   HDFS Data Upload Script (PowerShell)                 "
Write-Host "--------------------------------------------------------"
Write-Host ""

if (-Not (Test-Path $LocalFile)) {
    Write-Host "[Error] File not found: $LocalFile"
    Write-Host "   Run first: python scripts/generate_data.py --output data.json"
    exit 1
}

$ItemInfo = Get-Item $LocalFile
$FileSize = [math]::Round($ItemInfo.Length / 1MB, 2).ToString() + " MB"
Write-Host "Local file: $LocalFile ($FileSize)"
Write-Host "HDFS target: $HdfsDir/$HdfsFile"
Write-Host ""

$ContainerCheck = docker ps --format '{{.Names}}' | Select-String $Container
if (-not $ContainerCheck) {
    Write-Host "[Error] Container '$Container' is not running."
    Write-Host "   Run: docker-compose up -d"
    exit 1
}

Write-Host "1. Copying $LocalFile into Hadoop container..."
docker cp $LocalFile "$Container`:/tmp/$HdfsFile"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   [Error] Failed to copy file into container"
    exit 1
}
Write-Host "   [Success] File copied to container:/tmp/$HdfsFile"

Write-Host "2. Creating HDFS directory: $HdfsDir ..."
docker exec $Container hdfs dfs -mkdir -p $HdfsDir
Write-Host "   [Success] Directory created"

Write-Host "3. Uploading to HDFS: $HdfsDir/$HdfsFile ..."
docker exec $Container hdfs dfs -put -f "/tmp/$HdfsFile" "$HdfsDir/$HdfsFile"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   [Error] Failed to upload to HDFS"
    exit 1
}
Write-Host "   [Success] Upload successful"

Write-Host "4. Verifying upload..."
docker exec $Container hdfs dfs -ls "$HdfsDir/$HdfsFile"

Write-Host "5. Testing WebHDFS API access..."
$WebHdfsUrl = "http://localhost:9870/webhdfs/v1$HdfsDir/$HdfsFile?op=GETFILESTATUS&user.name=root"
try {
    $Response = Invoke-WebRequest -Uri $WebHdfsUrl -UseBasicParsing -ErrorAction SilentlyContinue
    if ($Response.StatusCode -eq 200) {
        Write-Host "   WebHDFS API returns HTTP 200 - Node.js can fetch this file!"
    } else {
        Write-Host "    WebHDFS returned HTTP $($Response.StatusCode)"
    }
} catch {
    Write-Host "    WebHDFS API Request Failed: $($_.Exception.Message)"
}

docker exec $Container rm -f "/tmp/$HdfsFile"

Write-Host ""
Write-Host "--------------------------------------------------------"
Write-Host "Done! Data is live at HDFS: $HdfsDir/$HdfsFile"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  Use your React Frontend to trigger the Analysis Pipeline, or run:"
Write-Host "  curl -X POST http://localhost:5050/api/load-from-hadoop  (Requires Admin JWT)"
Write-Host "  curl -X POST http://localhost:5050/api/analyze           (Requires Admin JWT)"
Write-Host "--------------------------------------------------------"
