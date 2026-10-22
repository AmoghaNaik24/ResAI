import socket
import uvicorn
import webbrowser
import threading
import time


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Checks whether the specified port is already bound on host."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return False
        except OSError:
            return True


def find_available_port(start_port: int = 8000, max_tries: int = 10, host: str = "127.0.0.1") -> int:
    """Finds an available TCP port starting at start_port."""
    for p in range(start_port, start_port + max_tries):
        if not is_port_in_use(p, host):
            return p
    return start_port


def open_browser(url: str):
    """Opens browser after server starts."""
    time.sleep(1.5)
    try:
        webbrowser.open(url)
    except Exception:
        pass


if __name__ == "__main__":
    port = find_available_port(8000)
    url = f"http://127.0.0.1:{port}"
    print("=" * 70)
    print("Launching ResAI - AI-Assisted Research Data Analysis & Reporting Platform")
    print(f"Access URL: {url}")
    print("=" * 70)
    threading.Thread(target=open_browser, args=(url,), daemon=True).start()
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)
