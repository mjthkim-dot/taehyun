#!/usr/bin/env python3
"""
사용자·데이터 관리 CLI — 웹에서 가입을 받지 않는다(초대제).

  python3 manage.py adduser 태현 --admin     # 접속 코드는 프롬프트로 입력
  python3 manage.py list
  python3 manage.py passwd 태현
  python3 manage.py disable 태현 / enable 태현
  python3 manage.py deluser 태현 --purge     # --purge면 그 사용자의 데이터 폴더까지 삭제
  python3 manage.py adopt 태현               # 기존 로컬 store.db를 이 사용자 것으로 이관
  python3 manage.py backup [--out 폴더]      # 모든 사용자 DB 스냅샷 백업

인증이 켜지는 조건: 사용자가 1명 이상 존재. 그 순간부터 모든 API가 로그인을
요구하므로, 첫 사용자를 만들기 전에 이 파일부터 읽게 되어 있다.
"""
from __future__ import annotations

import argparse
import getpass
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))
import auth  # noqa: E402
import rag  # noqa: E402


def _ask_code(confirm: bool = True) -> str:
    code = getpass.getpass("접속 코드(8자 이상, 로그인 비밀번호): ")
    if confirm and getpass.getpass("한 번 더: ") != code:
        sys.exit("두 입력이 다릅니다.")
    return code


def cmd_adduser(a):
    code = a.code or _ask_code()
    u = auth.add_user(a.name, code, admin=a.admin)
    d = auth.user_data_dir(u["id"])
    print(f"✅ 사용자 #{u['id']} '{u['name']}'"
          + (" (관리자)" if u["admin"] else "") + f" — 데이터: {d}")
    if len(auth.list_users()) == 1:
        print("ℹ️ 첫 사용자가 생겨 이제 모든 API가 로그인을 요구합니다.")
        legacy = rag.DB_PATH
        if legacy.exists():
            print(f"ℹ️ 기존 로컬 데이터({legacy.name})가 있습니다 — "
                  f"이 사용자 것으로 옮기려면: python3 manage.py adopt {u['name']}")


def cmd_list(a):
    users = auth.list_users()
    if not users:
        print("사용자가 없습니다 — 인증 비활성(로컬 개인 모드).")
        return
    for u in users:
        st = rag.Store(auth.user_data_dir(u["id"]) / "store.db").stats()
        flags = ("관리자 " if u["admin"] else "") + ("정지" if u["disabled"] else "")
        print(f"#{u['id']:<3} {u['name']:<12} {flags:<8} 자료 {st['total']}청크 "
              f"· 생성 {u['created_at']}")


def cmd_passwd(a):
    auth.set_code(a.name, a.code or _ask_code())
    print(f"✅ '{a.name}' 접속 코드 변경됨")


def cmd_disable(a):
    auth.set_disabled(a.name, True)
    print(f"✅ '{a.name}' 정지 — 기존 세션도 즉시 거부됩니다")


def cmd_enable(a):
    auth.set_disabled(a.name, False)
    print(f"✅ '{a.name}' 재개")


def cmd_deluser(a):
    users = {u["name"]: u for u in auth.list_users()}
    u = users.get(a.name)
    if not u:
        sys.exit(f"사용자를 찾을 수 없습니다: {a.name}")
    d = auth.USERS_DIR / str(u["id"])
    if a.purge and d.exists():
        if not a.yes and input(f"'{a.name}'의 데이터 폴더 {d} 를 완전히 삭제합니다. 입력 'delete': ") != "delete":
            sys.exit("취소했습니다.")
        shutil.rmtree(d)
        print(f"🗑 데이터 폴더 삭제: {d}")
    auth.delete_user(a.name)
    print(f"✅ 사용자 삭제: {a.name}" + ("" if a.purge else
          f"  (데이터 폴더는 남아 있습니다: {d} — 지우려면 --purge)"))


def cmd_adopt(a):
    """로컬 개인 모드에서 쓰던 store.db를 지정 사용자 소유로 이관."""
    users = {u["name"]: u for u in auth.list_users()}
    u = users.get(a.name)
    if not u:
        sys.exit(f"사용자를 찾을 수 없습니다: {a.name}")
    src = rag.DB_PATH
    if not src.exists():
        sys.exit(f"이관할 로컬 데이터가 없습니다: {src}")
    dst = auth.user_data_dir(u["id"]) / "store.db"
    if dst.exists() and rag.Store(dst).stats()["total"] > 0:
        sys.exit(f"'{a.name}'에게 이미 데이터가 있습니다({dst}) — 덮어쓰지 않습니다.")
    # WAL 꼬리까지 안전하게: 파일 복사가 아니라 sqlite backup API로 스냅샷을 뜬다
    rag.Store(src).backup(dst)
    bak = src.with_suffix(f".adopted-{time.strftime('%Y%m%d-%H%M%S')}.bak")
    src.rename(bak)
    for tail in ("-wal", "-shm"):
        p = Path(str(src) + tail)
        if p.exists():
            p.unlink()
    print(f"✅ {src.name} → {dst}  (원본은 {bak.name} 으로 보관)")
    print(f"   이관된 자료: {rag.Store(dst).stats()['total']}청크")


def cmd_backup(a):
    out = Path(a.out or (auth.DATA_DIR / "backups" / time.strftime("%Y%m%d-%H%M%S")))
    n = 0
    if rag.DB_PATH.exists():
        rag.Store(rag.DB_PATH).backup(out / "local-store.db")
        n += 1
    for u in auth.list_users():
        src = auth.user_data_dir(u["id"]) / "store.db"
        if src.exists():
            rag.Store(src).backup(out / f"u{u['id']}-{u['name']}-store.db")
            n += 1
    if auth.AUTH_DB.exists():
        # rag.Store를 쓰면 auth.db에 색인 스키마가 생겨버린다 — 원시 backup API로
        import sqlite3
        out.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(auth.AUTH_DB) as src_c, \
                sqlite3.connect(out / "auth.db") as dst_c:
            src_c.backup(dst_c)
        n += 1
    print(f"✅ {n}개 DB 스냅샷 → {out}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("adduser"); p.add_argument("name")
    p.add_argument("--admin", action="store_true")
    p.add_argument("--code", help="비대화식 지정(스크립트용) — 셸 히스토리에 남으니 주의")
    p.set_defaults(f=cmd_adduser)

    p = sub.add_parser("list"); p.set_defaults(f=cmd_list)

    p = sub.add_parser("passwd"); p.add_argument("name")
    p.add_argument("--code"); p.set_defaults(f=cmd_passwd)

    p = sub.add_parser("disable"); p.add_argument("name"); p.set_defaults(f=cmd_disable)
    p = sub.add_parser("enable"); p.add_argument("name"); p.set_defaults(f=cmd_enable)

    p = sub.add_parser("deluser"); p.add_argument("name")
    p.add_argument("--purge", action="store_true")
    p.add_argument("--yes", action="store_true")
    p.set_defaults(f=cmd_deluser)

    p = sub.add_parser("adopt"); p.add_argument("name"); p.set_defaults(f=cmd_adopt)

    p = sub.add_parser("backup"); p.add_argument("--out"); p.set_defaults(f=cmd_backup)

    a = ap.parse_args()
    try:
        a.f(a)
    except ValueError as e:
        sys.exit(f"❌ {e}")


if __name__ == "__main__":
    main()
