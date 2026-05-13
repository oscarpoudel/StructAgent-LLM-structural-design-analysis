
cd "C:\Users\oscar poudel\Projects\struct_analysis"
$job = Start-Job -ScriptBlock { 
    cd "C:\Users\oscar poudel\Projects\struct_analysis"
    conda run -n struct-agent python -m flask --app app.main run 
}
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri "http://127.0.0.1:5000/" -UseBasicParsing | Select-Object StatusCode
Receive-Job -Job $job
Stop-Job -Job $job

