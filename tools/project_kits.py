"""Build small, reproducible starting datasets and notebooks for the capstones."""
import csv
from datetime import datetime, timedelta
from io import StringIO
import json
from pathlib import Path
from random import Random
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/kits'
OUT.mkdir(exist_ok=True)
PROJECTS = {p['id']: p for p in json.loads((ROOT / 'dist/content/catalogue.json').read_text())['projects']}


def csv_text(columns, records):
    stream = StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(columns)
    writer.writerows(records)
    return stream.getvalue()


def notebook(title, instructions, baseline):
    def markdown(text):
        return dict(cell_type='markdown', metadata={}, source=text.splitlines(keepends=True))
    def code(text):
        return dict(cell_type='code', metadata={}, source=text.splitlines(keepends=True), outputs=[], execution_count=None)
    cells = [markdown('# ' + title + '\n\n' + instructions), code(baseline),
             markdown('## Ваш эксперимент\n\nОбучите модель на обучающей части. Сравните её с исходным результатом на тех же отложенных наблюдениях. Опишите ошибки и границы применимости.'),
             code('# Добавьте свой эксперимент.')]
    return json.dumps(dict(nbformat=4, nbformat_minor=4, metadata={'kernelspec': {'name':'python3','language':'python','display_name':'Python 3'}}, cells=cells), ensure_ascii=False, indent=2)


def save(name, assets, instructions, baseline):
    project = PROJECTS[name]
    readme = '# ' + project['title'] + '\n\n' + instructions + '\n\nРаспакуйте архив и откройте start.ipynb в Jupyter. Начальные ячейки используют стандартную библиотеку Python 3. Приложите к отчёту код эксперимента, описание разбиения и сравнение с базовой моделью.\n'
    assets = {**assets, 'README.md':readme, 'start.ipynb':notebook(project['title'], instructions, baseline)}
    with ZipFile(OUT / (name + '.zip'), 'w') as archive:
        for path, data in sorted(assets.items()):
            item = ZipInfo(path, (2026, 1, 1, 0, 0, 0))
            item.compress_type = ZIP_DEFLATED
            archive.writestr(item, data.encode() if isinstance(data, str) else data)


def delivery():
    rng = Random(41)
    start = datetime(2025, 3, 1, 7)
    rows = []
    for i in range(600):
        moment = start + timedelta(minutes=90*i)
        km = round(rng.uniform(.4, 12), 2)
        couriers = rng.randint(3, 15)
        region = rng.choice(['север', 'центр', 'юг'])
        rush = moment.hour in (8, 9, 12, 13, 18, 19)
        promised = 23 if km < 6 else 39
        actual = max(6, round(8 + 2.15*km + 8*rush + 7*(couriers<7) + 3*(region=='центр') + rng.gauss(0, 4)))
        rows.append((f'O{i:04d}', moment.isoformat(), region, km, couriers, promised, actual, int(actual>promised)))
    return csv_text(['order_id','placed_at','district','distance_km','available_couriers','promised_min','actual_min','late'], rows)


data = {'orders.csv':delivery()}
load_orders = """import csv
from statistics import median
with open('orders.csv', encoding='utf-8') as source:
    rows = list(csv.DictReader(source))
rows.sort(key=lambda r: r['placed_at'])
train, test = rows[:480], rows[480:]
"""
order_note = '600 синтетических заказов одной учебной службы. Признаки известны при оформлении. actual_min и late вычислены после доставки, их нельзя передавать модели как признаки. Последние 120 заказов составляют контрольный период.'
save('eta', data, order_note, load_orders + """baseline = median(float(r['actual_min']) for r in train)
mae = sum(abs(float(r['actual_min']) - baseline) for r in test) / len(test)
print('MAE медианного прогноза в минутах', round(mae, 2))""")
save('delay', data, order_note + ' Цель — признак late. Для следующего эксперимента обучите MLP на PyTorch. Подберите порог на хронологически выделенной валидации внутри обучающей части.', load_orders + """def prediction(row):
    return int(int(row['available_couriers']) < 7)
tp = sum(prediction(r) == 1 and r['late'] == '1' for r in test)
fp = sum(prediction(r) == 1 and r['late'] == '0' for r in test)
fn = sum(prediction(r) == 0 and r['late'] == '1' for r in test)
print('F1 простого правила', round(2*tp / max(1, 2*tp+fp+fn), 3))""")

rng = Random(14)
records, pictures = [], {}
for item in range(60):
    label = ('цела', 'разрыв', 'вмятина')[item%3]
    for view in range(2):
        shift, size = rng.randint(-2, 2), rng.randint(7, 9)
        light = 24 if view == 0 else -20
        pixels = bytearray()
        for y in range(32):
            for x in range(32):
                dx, dy = x - 16 - shift, y - 16
                inside = abs(dx) <= size and abs(dy) <= size
                value = 150 if inside else 40
                if inside and (abs(dx) == size or abs(dy) == size or dx == 0):
                    value = 98
                if inside and label == 'разрыв' and -6 <= dy <= 6 and abs(dx - dy//2) <= 1:
                    value = 35
                if inside and label == 'вмятина' and dx > 2 and dy < -3 and dx-dy>10:
                    value = 65
                pixels.append(max(0, min(255, value + light + rng.randint(-10,10))))
        path = f'images/{item:03d}-{view}.pgm'
        pictures[path] = b'P5\n32 32\n255\n' + pixels
        records.append((f'p{item:03d}', path, label, ['светло','темно'][view], 'train' if item<42 else 'valid' if item<51 else 'test'))
pictures['labels.csv'] = csv_text(['parcel_id','path','label','light','split'], records)
save('vision', pictures, '120 синтетических изображений PGM, три класса и два условия освещения. Два вида каждой упаковки принадлежат одной выборке. Этими изображениями можно проверить загрузчик, цикл обучения и метрики. Для оценки на фотографиях добавьте отдельный разрешённый набор реальных снимков.', """import csv
from collections import Counter
from pathlib import Path
with open('labels.csv', encoding='utf-8') as file:
    rows = list(csv.DictReader(file))
train = [r for r in rows if r['split'] == 'train']
test = [r for r in rows if r['split'] == 'test']
assert {r['parcel_id'] for r in train}.isdisjoint(r['parcel_id'] for r in test)
data = Path(train[0]['path']).read_bytes()
assert data.startswith(b'P5\\n32 32\\n255\\n')
baseline = Counter(r['label'] for r in train).most_common(1)[0][0]
print('Accuracy частого класса', round(sum(r['label'] == baseline for r in test)/len(test), 3))""")

articles = [
 ('A01','Смена адреса','Клиент может изменить адрес в приложении, пока курьер не подтвердил получение заказа.'),
 ('A02','Возврат упаковки','Возврат многоразовой упаковки оформляет курьер при следующей доставке.'),
 ('A03','Ошибка в чеке','При ошибке в чеке поддержка запрашивает номер заказа и исправляет документ.'),
 ('A04','Перерыв курьера','Для перерыва курьер завершает активный заказ и выбирает статус «перерыв».'),
 ('A05','Отмена заказа','До начала сборки клиент может отменить заказ через карточку заказа.'),
 ('A06','Пропуск в здание','Если для входа нужен пропуск, клиент сообщает об этом курьеру в чате.'),
 ('A07','Оплата картой','При отказе банка клиент может повторить оплату другой картой.'),
 ('A08','Повреждение заказа','Если товар повреждён, приложите фото упаковки к обращению в поддержку.'),
]
questions = [('Как изменить адрес доставки?','A01'),('Кто принимает пустую упаковку?','A02'),('Что нужно для исправления чека?','A03'),('Как уйти на перерыв?','A04'),('Когда возможна отмена заказа?','A05'),('Нужен пропуск на проходной, что делать?','A06'),('Оплата картой отклонена банком.','A07'),('Товар повреждён при доставке.','A08'),('Можно ли заказать доставку в другой стране?',''),('Есть ли ночная доставка из аптеки?','')]
save('rag', {'documents.csv':csv_text(['doc_id','title','text'],articles), 'questions.csv':csv_text(['question','expected_doc'],questions)}, 'Восемь вымышленных правил доставки и десять вопросов, у двух из них нет ответа в базе. Сравните лексический поиск с эмбеддингами, затем измерьте качество цитирования и корректность отказов. Не подбирайте порог на контрольных вопросах.', """import csv, re
def read_csv(path):
    with open(path, encoding='utf-8') as file:
        return list(csv.DictReader(file))
def words(text):
    return set(re.findall(r'\\w+', text.lower()))
docs, queries = read_csv('documents.csv'), read_csv('questions.csv')
def search(query):
    scores = [(len(words(query) & words(d['title']+' '+d['text'])), d['doc_id']) for d in docs]
    score, doc_id = max(scores)
    return doc_id if score else ''
answerable = [q for q in queries if q['expected_doc']]
print('Recall@1', sum(search(q['question']) == q['expected_doc'] for q in answerable) / len(answerable))""")

if __name__ == '__main__':
    print('Project kits:', ', '.join(sorted(p.name for p in OUT.glob('*.zip'))))
