import uvicorn
import webbrowser
import threading
import time


def open_browser():
    time.sleep(1.5)
    webbrowser.open("http://127.0.0.1:8000")


if __name__ == "__main__":
    print("=" * 70)
    print("Launching ResAI - AI-Assisted Research Data Analysis & Reporting Platform")
    print("Access URL: http://127.0.0.1:8000")
    print("=" * 70)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
