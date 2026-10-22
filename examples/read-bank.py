import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
package=root/'app/content/packages/english-ai-reviewed-v1/activities.json'
rows=json.loads(package.read_text(encoding='utf-8'))['activities']
print('English questions:',len(rows))
for row in rows[:2]:
    print(row['id'],row['prompt'])
    print(json.dumps(row.get('sourceMetadata',{}),ensure_ascii=False))
