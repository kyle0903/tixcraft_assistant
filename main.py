from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                            QHBoxLayout, QPushButton, QLineEdit, QLabel, 
                            QRadioButton, QListWidget, QTextEdit, QMessageBox,
                            QGroupBox, QButtonGroup)
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from getTicket import TicketScraper
import webbrowser
import time
import sys
from PyQt5.QtGui import QIcon
import os

class TicketQueryWorker(QThread):
    message_signal = pyqtSignal(str)
    result_signal = pyqtSignal(object)
    finished_signal = pyqtSignal()

    def __init__(self, scraper, url, arr_keyword, is_default_var):
        super().__init__()
        self.scraper = scraper
        self.url = url
        self.arr_keyword = arr_keyword
        self.is_default_var = is_default_var
        self._is_running = True

    def run(self):
        import time
        start_time = time.time()
        while self._is_running:
            results = self.scraper.get_ticket_urls(self.url, self.arr_keyword, self.is_default_var)
            if isinstance(results, dict) and "msg" in results:
                self.message_signal.emit(results["msg"])
                time.sleep(1)
                continue
            break
        end_time = time.time()
        self.message_signal.emit(f"查詢時間: {end_time - start_time:.2f}秒\n")
        self.result_signal.emit(results)
        self.finished_signal.emit()

    def stop(self):
        self._is_running = False

class TicketGUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.scraper = TicketScraper(print_callback=self.append_result_text)
        self.arr_keyword = []
        self.initUI()

    def initUI(self):
        # 設定視窗
        self.setWindowTitle("拓元購票連結查詢工具")
        self.setGeometry(100, 100, 900, 700)
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f5f5f5;
            }
            QLabel {
                color: #333333;
                font-size: 12px;
            }
            QLineEdit {
                padding: 5px;
                border: 1px solid #cccccc;
                border-radius: 3px;
                background-color: white;
            }
            QLineEdit:focus {
                border: 1px solid #007bff;
            }
            QRadioButton {
                color: #333333;
                font-size: 12px;
            }
            QListWidget {
                border: 1px solid #cccccc;
                border-radius: 3px;
                background-color: white;
            }
            QTextEdit {
                border: 1px solid #cccccc;
                border-radius: 3px;
                background-color: white;
            }
        """)

        # 主視窗部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)

        # 標題
        title = QLabel("**貼心提醒**\n**使用該系統前請先確認是否已登入拓元會員**")
        title.setStyleSheet("""
            color: #dc3545;
            font-weight: bold;
            font-size: 14px;
            padding: 10px;
            background-color: #f8d7da;
            border-radius: 5px;
        """)
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        # URL 輸入區
        url_group = QGroupBox("活動網址")
        url_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                border: 1px solid #cccccc;
                border-radius: 5px;
                margin-top: 10px;
                padding-top: 15px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)
        url_layout = QVBoxLayout()
        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("請輸入拓元活動網址")
        url_layout.addWidget(self.url_input)
        url_group.setLayout(url_layout)
        layout.addWidget(url_group)

        # 查詢設定區
        settings_group = QGroupBox("查詢設定")
        settings_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                border: 1px solid #cccccc;
                border-radius: 5px;
                margin-top: 10px;
                padding-top: 15px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)
        settings_layout = QHBoxLayout()
        settings_layout.setSpacing(20)  # 設定水平間距
        
        # 左側：查詢場次
        session_layout = QVBoxLayout()
        session_layout.setSpacing(5)  # 設定垂直間距
        session_label = QLabel("查詢場次:")
        session_label.setStyleSheet("font-weight: bold;")
        session_layout.addWidget(session_label)
        
        self.session_button_group = QButtonGroup()
        self.is_default_var = "y"
        self.default_radio = QRadioButton("查詢所有場次")
        self.default_radio.setChecked(True)
        self.default_radio.toggled.connect(lambda: self.set_default_var("y"))
        self.session_button_group.addButton(self.default_radio)
        session_layout.addWidget(self.default_radio)
        
        self.first_day_radio = QRadioButton("僅查詢第一天場次")
        self.first_day_radio.toggled.connect(lambda: self.set_default_var("n"))
        self.session_button_group.addButton(self.first_day_radio)
        session_layout.addWidget(self.first_day_radio)
        
        # 右側：查詢票種
        ticket_layout = QVBoxLayout()
        ticket_layout.setSpacing(5)  # 設定垂直間距
        ticket_label = QLabel("查詢票種:")
        ticket_label.setStyleSheet("font-weight: bold;")
        ticket_layout.addWidget(ticket_label)
        
        self.ticket_button_group = QButtonGroup()
        self.is_keyword_var = "n"
        self.all_tickets_radio = QRadioButton("所有票種")
        self.all_tickets_radio.setChecked(True)
        self.all_tickets_radio.toggled.connect(lambda: self.set_keyword_var("n"))
        self.ticket_button_group.addButton(self.all_tickets_radio)
        ticket_layout.addWidget(self.all_tickets_radio)
        
        self.specific_tickets_radio = QRadioButton("指定票種")
        self.specific_tickets_radio.toggled.connect(lambda: self.set_keyword_var("y"))
        self.ticket_button_group.addButton(self.specific_tickets_radio)
        ticket_layout.addWidget(self.specific_tickets_radio)
        
        # 將兩個垂直布局加入水平布局
        settings_layout.addLayout(session_layout)
        settings_layout.addLayout(ticket_layout)
        
        # 設定兩個區域的寬度比例
        settings_layout.setStretch(0, 1)
        settings_layout.setStretch(1, 1)
        
        # 設定 GroupBox 的最小高度
        settings_group.setMinimumHeight(100)  # 調整這個值來改變高度
        
        settings_group.setLayout(settings_layout)
        layout.addWidget(settings_group)

        # 關鍵字輸入區
        self.keyword_group = QGroupBox("關鍵字設定")
        self.keyword_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                border: 1px solid #cccccc;
                border-radius: 5px;
                margin-top: 10px;
                padding-top: 15px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)
        keyword_layout = QVBoxLayout()
        
        input_layout = QHBoxLayout()
        self.keyword_input = QLineEdit()
        self.keyword_input.setPlaceholderText("輸入票價或座位區域")
        input_layout.addWidget(self.keyword_input)
        
        add_keyword_btn = QPushButton("加入關鍵字")
        add_keyword_btn.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                padding: 5px 15px;
                border-radius: 3px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        add_keyword_btn.clicked.connect(self.add_keyword)
        input_layout.addWidget(add_keyword_btn)
        keyword_layout.addLayout(input_layout)
        
        list_layout = QHBoxLayout()
        self.keyword_list = QListWidget()
        self.keyword_list.setMaximumHeight(100)
        list_layout.addWidget(self.keyword_list)
        
        button_layout = QVBoxLayout()
        remove_keyword_btn = QPushButton("移除關鍵字")
        remove_keyword_btn.setStyleSheet("""
            QPushButton {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 5px 15px;
                border-radius: 3px;
            }
            QPushButton:hover {
                background-color: #c82333;
            }
        """)
        remove_keyword_btn.clicked.connect(self.remove_keyword)
        button_layout.addWidget(remove_keyword_btn)
        
        clear_keyword_btn = QPushButton("清空關鍵字")
        clear_keyword_btn.setStyleSheet("""
            QPushButton {
                background-color: #6c757d;
                color: white;
                border: none;
                padding: 5px 15px;
                border-radius: 3px;
            }
            QPushButton:hover {
                background-color: #5a6268;
            }
        """)
        clear_keyword_btn.clicked.connect(self.clear_keyword)
        button_layout.addWidget(clear_keyword_btn)
        list_layout.addLayout(button_layout)
        
        keyword_layout.addLayout(list_layout)
        self.keyword_group.setLayout(keyword_layout)
        layout.addWidget(self.keyword_group)
        
        # 初始隱藏關鍵字設定區
        self.keyword_group.hide()

        # 查詢按鈕
        self.query_button = QPushButton("開始查詢")
        self.query_button.setStyleSheet("""
            QPushButton {
                background-color: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                font-size: 14px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #0056b3;
            }
        """)
        self.query_button.clicked.connect(self.start_query)
        layout.addWidget(self.query_button)

        # 結果顯示區
        result_group = QGroupBox("查詢結果")
        result_group.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                border: 1px solid #cccccc;
                border-radius: 5px;
                margin-top: 10px;
                padding-top: 15px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)
        result_layout = QVBoxLayout()
        self.result_text = QTextEdit()
        self.result_text.setReadOnly(True)
        result_layout.addWidget(self.result_text)
        result_group.setLayout(result_layout)
        layout.addWidget(result_group)

    def set_default_var(self, value):
        self.is_default_var = value

    def set_keyword_var(self, value):
        self.is_keyword_var = value
        if value == "y":
            self.keyword_group.show()
        else:
            self.keyword_group.hide()
            self.keyword_list.clear()
            self.arr_keyword = []

    def add_keyword(self):
        keyword = self.keyword_input.text().strip()
        if keyword:
            self.arr_keyword.append(keyword)
            self.keyword_list.addItem(keyword)
            self.keyword_input.clear()

    def remove_keyword(self):
        current_row = self.keyword_list.currentRow()
        if current_row >= 0:
            self.keyword_list.takeItem(current_row)
            self.arr_keyword.pop(current_row)

    def clear_keyword(self):
        self.keyword_list.clear()
        self.arr_keyword = []

    def start_query(self):
        url = self.url_input.text().strip()
        self.result_text.clear()
        
        if not url.startswith("https://tixcraft.com/"):
            QMessageBox.critical(self, "錯誤", "請輸入拓元網址")
            return
            
        try:
            if url.split("/")[-2] != "detail" or url.split("/")[-3] != "activity":
                QMessageBox.critical(self, "錯誤", "網址格式有誤")
                return
            if url.split("/")[-1] == "":
                QMessageBox.critical(self, "錯誤", "請輸入票種網址")
                return
        except Exception:
            QMessageBox.critical(self, "錯誤", "網址格式有誤")
            return
            
        self.query_button.setEnabled(False)
        self.worker = TicketQueryWorker(self.scraper, url, self.arr_keyword, self.is_default_var)
        self.worker.message_signal.connect(self.append_result_text)
        self.worker.result_signal.connect(self.handle_query_result)
        self.worker.finished_signal.connect(self.query_finished)
        self.worker.start()

    def append_result_text(self, msg):
        self.result_text.append(msg)

    def handle_query_result(self, results):
        if isinstance(results, list) and results:
            for result in results:
                for ticket_type, ticket_url in result.items():
                    if ticket_url and ticket_url != "(空)":
                        webbrowser.open(ticket_url)
                        self.result_text.append(f"已自動開啟票種: {ticket_type}\n")
                        return
            self.result_text.append("沒有找到可用票種\n")
        else:
            self.result_text.append(f"{results}\n")

    def query_finished(self):
        self.query_button.setEnabled(True)

def resource_path(relative_path):
    """取得資源檔案的絕對路徑，支援 pyinstaller 打包後的情境"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = TicketGUI()
    window.setWindowIcon(QIcon(resource_path("icon.ico")))
    window.show()
    sys.exit(app.exec_())