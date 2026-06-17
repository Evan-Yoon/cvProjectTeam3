import psutil

for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cmdline = proc.info.get('cmdline')
        if cmdline and 'uvicorn' in ' '.join(cmdline).lower():
            print(f"Found Uvicorn PID: {proc.info['pid']} - Cmd: {cmdline}")
            proc.kill()
            print("Killed.")
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
