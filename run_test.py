
import subprocess
import time
import requests

p = subprocess.Popen(
    ['conda', 'run', '-n', 'struct-agent', 'python', '-m', 'flask', '--app', 'app.main', 'run'],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
)
time.sleep(5)
try:
    resp = requests.get('http://127.0.0.1:5000/')
    print('STATUS:', resp.status_code)
except Exception as e:
    print('FAILED TO CONNECT:', e)

p.terminate()
out, err = p.communicate()
print('STDOUT:\n', out)
print('STDERR:\n', err)

