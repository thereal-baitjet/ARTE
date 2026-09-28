#!/usr/bin/env python3
"""Fetch a bounded, resumable candidate snapshot. This command never changes the live catalog."""
from __future__ import annotations
import argparse, concurrent.futures, datetime, json, pathlib, threading, urllib.parse
from met_import_common import API, atomic_json, fresh_snapshot, request_json, valid_record
ROOT = pathlib.Path(__file__).resolve().parents[1]
QUERIES = ['Vincent van Gogh','Claude Monet','Edgar Degas','Auguste Renoir','Paul Cézanne','Édouard Manet','Georges Seurat','Camille Pissarro','Mary Cassatt','Berthe Morisot','Rembrandt','Johannes Vermeer','Frans Hals','El Greco','Francisco Goya','Diego Velázquez','Albrecht Dürer','Katsushika Hokusai','Utagawa Hiroshige','Auguste Rodin','Antonio Canova','Gian Lorenzo Bernini','Louis Comfort Tiffany','René Lalique','William Morris','Joseph Mallord William Turner','John Constable','Winslow Homer','John Singer Sargent','Kiyohara Yukinobu','William Blake','James McNeill Whistler','Eugène Delacroix','Gustave Courbet','Jean-François Millet','Honoré Daumier','Odilon Redon','Henri de Toulouse-Lautrec','Paul Gauguin','Edvard Munch','Pierre Bonnard','Édouard Vuillard','Félix Vallotton','Giovanni Battista Piranesi','Giovanni Battista Tiepolo','Canaletto','Giovanni Battista Moroni','Sandro Botticelli','Raphael','Titian','Paolo Veronese','Jacopo Tintoretto','Peter Paul Rubens','Anthony van Dyck','Nicolas Poussin','Claude Lorrain','Jean-Honoré Fragonard','François Boucher','Jean-Antoine Watteau','Jacques Louis David','Jean Auguste Dominique Ingres','Thomas Cole','Frederic Edwin Church','Albert Bierstadt','Childe Hassam','George Inness','William Merritt Chase','Henry Ossawa Tanner','Thomas Eakins','Robert Henri','Arthur B. Davies','Joaquín Sorolla','Anders Zorn','Carl Larsson','Dante Gabriel Rossetti','Edward Burne-Jones','John Everett Millais','William Holman Hunt','Utagawa Kuniyoshi','Kitagawa Utamaro','Suzuki Harunobu','Torii Kiyonaga','Katsukawa Shunsho','Ogata Korin','Sakai Hoitsu','Ito Jakuchu','Shibata Zeshin','Qi Baishi','Shen Zhou','Wen Zhengming','Bada Shanren','Ren Yi','Xu Gu','Zhao Zhiqian','Muhammad Zaman','Reza Abbasi','Bichitr','Abu al-Hasan','Mansur','Ustad Mansur']


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',type=int,default=500); parser.add_argument('--workers',type=int,default=12)
    parser.add_argument('--per-query',type=int,default=8); parser.add_argument('--max-pages',type=int,default=3)
    parser.add_argument('--cache-hours',type=float,default=168); parser.add_argument('--root',type=pathlib.Path,default=ROOT)
    args=parser.parse_args(argv)
    if not 1 <= args.workers <= 12 or not 1 <= args.target <= 5000:parser.error('workers must be 1–12 and target 1–5000')
    cache=args.root/'.met-import-cache'; objects=cache/'objects'; objects.mkdir(parents=True,exist_ok=True)
    existing=json.loads((args.root/'lib/artworks/data/met-source-records.json').read_text())
    errors=[]; lock=threading.Lock(); resolved={}; blocked=set()
    def object_record(object_id, prior=None):
        with lock:
            if object_id in resolved:return resolved[object_id]
        path=objects/f'{object_id}.json'
        cached=json.loads(path.read_text()) if path.exists() else prior
        if cached and fresh_snapshot(cached,args.cache_hours):record=cached
        else:
            try:
                record=request_json(API+f'/v1/objects/{object_id}')
                record['_verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat(); record['_apiSource']=API+f'/v1/objects/{object_id}'
                atomic_json(path,record)
            except Exception as error:
                with lock:errors.append({'objectID':object_id,'stage':'metadata','error':str(error)[:200]})
                return None
        if not valid_record(record):
            with lock:blocked.add(object_id)
            return None
        with lock:resolved[object_id]=record
        return record
    preserved=[]
    for record in existing:
        refreshed=object_record(record['objectID'],record)
        if refreshed is None:
            atomic_json(cache/'import-report.json',{'status':'blocked','reason':'Existing record could not be reverified','objectID':record['objectID'],'errors':errors})
            raise SystemExit('An existing record could not be verified. Live catalog was not changed; inspect import-report.json.')
        preserved.append(refreshed)
    atomic_json(cache/'preserved-records.json',preserved)
    print(f'Preserved and rights-checked {len(preserved)} existing works.',flush=True)
    known={record['objectID'] for record in existing}
    def collect(query):
        accepted=[]; seen=set()
        for page in range(args.max_pages):
            params={'q':query,'artistOrCulture':'true','hasImages':'true','limit':50,'offset':page*50}
            try:found=request_json(API+'/v1.1/search?'+urllib.parse.urlencode(params))
            except Exception as error:
                with lock:errors.append({'query':query,'stage':'search','error':str(error)[:200]})
                break
            ids=found.get('objectIDs') or []
            for object_id in ids:
                if object_id in seen or object_id in known:continue
                seen.add(object_id); obj=object_record(object_id)
                if obj:accepted.append(obj)
                if len(accepted)>=args.per_query:break
            if len(accepted)>=args.per_query or len(ids)<50:break
        print(f'{query}: {len(accepted)} new cleared candidates',flush=True)
        return accepted
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:batches=list(executor.map(collect,QUERIES))
    # Round-robin queries before selecting: no first queried artist dominates the expansion.
    candidates=list(preserved); seen=set(known)
    for index in range(args.per_query):
        for batch in batches:
            if index<len(batch) and batch[index]['objectID'] not in seen:
                candidates.append(batch[index]);seen.add(batch[index]['objectID'])
    report={'status':'ready' if len(candidates)>=args.target else 'insufficient','target':args.target,'preserved':len(preserved),'candidates':len(candidates),'errors':errors,'rejectedObjectIds':sorted(blocked)}
    atomic_json(cache/'import-report.json',report)
    if len(candidates)<args.target:raise SystemExit(f'Only {len(candidates)} cleared candidates. Live catalog was not changed.')
    atomic_json(cache/'candidate-records.json',candidates)
    print(json.dumps(report),flush=True)

if __name__=='__main__':main()
