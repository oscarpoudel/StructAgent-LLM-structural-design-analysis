
Start-Process -NoNewWindow -FilePath conda -ArgumentList "run -n struct-agent python -m flask --app app.main run"
Start-Sleep 5
curl.exe http://127.0.0.1:5000/

