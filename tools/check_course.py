"""Verify the catalog and execute each reference solution with the site's own grader."""
from collections import Counter
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'dist' / 'content'
grade = runpy.run_path(str(ROOT / 'dist/runtime/grade.py'))['tensorium_grade']
EXPECTED_TASKS = [5, 24, 24, 24, 18, 18, 18, 18, 18, 12, 16, 18, 20, 18, 18, 18, 18, 6]
counts = Counter()


def check_choice(item):
    assert item['prompt'] and item['explanation']
    assert len(set(item['options'])) == len(item['options']) >= 2
    assert isinstance(item['answer'], int) and 0 <= item['answer'] < len(item['options'])


def check_task(task, context):
    assert task['title'] and task['prompt'], context
    if task['type'] == 'choice':
        check_choice(task)
        return
    assert task['type'] == 'code' and task['starter'] and task['tests'], context
    tests = json.dumps(task['tests'])
    result = json.loads(grade(task['solution'], tests))
    assert not result.get('error'), (context, result)
    assert all(check['passed'] for check in result['results']), (context, result)
    blank = json.loads(grade('', tests))
    assert not all(check['passed'] for check in blank['results']), (context, 'empty submission passed')
    counts['solutions'] += 1
    counts['assertions'] += len(task['tests'])


for index, task_count in enumerate(EXPECTED_TASKS):
    name = f'm{index:02d}'
    module = json.loads((CONTENT / f'{name}.json').read_text(encoding='utf-8'))
    assert len(module['tasks']) == task_count and len(module['quiz']) == 5, name
    for lesson in module['lessons']:
        assert lesson['title'] and all(lesson['body']) and len(lesson['body']) > 0
    for task in module['tasks']:
        check_task(task, (name, task['title']))
    for question in module['quiz']:
        check_choice(question)
    counts.update({section: len(module[section]) for section in ('lessons', 'tasks', 'quiz')})

extras = json.loads((CONTENT / 'catalogue.json').read_text(encoding='utf-8'))
for section in ('missions', 'incidents'):
    for case in extras[section]:
        assert (CONTENT / (case['module'] + '.json')).is_file()
        check_task(case['task'], case['id'])
    counts[section] = len(extras[section])
for project in extras['projects']:
    assert project['title'] and project['deliverables'] and len(project['rubric']) == 4
counts['projects'] = len(extras['projects'])
print('OK', dict(counts))
