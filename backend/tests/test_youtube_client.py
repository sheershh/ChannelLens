import pytest

from app.youtube import NotConfigured, QuotaExceeded, YouTubeClient, YouTubeError, parse_query
from tests.fake_youtube import ALPHA, BETA, EMPTY


@pytest.mark.parametrize("raw,expected", [
    (ALPHA, ("id", ALPHA)),
    ("@alphascience", ("handle", "@alphascience")),
    ("https://www.youtube.com/@alphascience", ("handle", "@alphascience")),
    ("youtube.com/@alphascience/videos", ("handle", "@alphascience")),
    (f"https://youtube.com/channel/{ALPHA}", ("id", ALPHA)),
    ("  alpha science ", ("search", "alpha science")),
    ("@ two words", ("search", "@ two words")),
])
def test_parse_query(raw, expected):
    assert parse_query(raw) == expected


def test_handle_lookup_costs_1_unit_and_name_search_costs_100(ytclient, yt):
    assert [r["id"] for r in ytclient.search_channels("@alphascience")] == [ALPHA]
    assert ytclient.units_used_today() == 1 and yt.count("search") == 0
    assert [r["id"] for r in ytclient.search_channels("builds")] == [BETA]
    assert ytclient.units_used_today() == 101


def test_responses_are_cached(ytclient, yt):
    ytclient.get_channels([ALPHA])
    ytclient.get_channels([ALPHA])
    assert yt.count("channels") == 1 and ytclient.units_used_today() == 1


def test_fresh_bypasses_cache(ytclient, yt):
    ytclient.get_channels([ALPHA])
    ytclient.get_channels([ALPHA], fresh=True)
    assert yt.count("channels") == 2


def test_get_channels_batches_by_50(ytclient, yt):
    ids = [ALPHA, BETA] + [f"UC{i:022d}" for i in range(60)]
    found = ytclient.get_channels(ids)
    assert {c["id"] for c in found} == {ALPHA, BETA}
    assert yt.count("channels") == 2   # 62 ids -> 2 calls, 2 units


def test_parse_channel_fields(ytclient):
    alpha, beta = ytclient.get_channels([ALPHA, BETA])
    assert alpha["subscribers"] == 1_200_000 and alpha["handle"] == "@alphascience"
    assert alpha["uploads_playlist_id"] == "UU" + "a" * 22
    assert beta["subscribers"] is None    # hidden by the creator
    assert beta["thumbnail_url"] == "https://yt3/beta.jpg"


def test_recent_videos_uses_playlist_not_search(ytclient, yt):
    vids = ytclient.recent_videos("UU" + "a" * 22)
    assert [v["id"] for v in vids] == ["a1", "a2", "a3", "a4"]
    assert vids[3]["likes"] is None and vids[1]["duration_seconds"] == 58
    assert yt.count("search") == 0 and ytclient.units_used_today() == 2


def test_recent_videos_missing_playlist_is_empty(ytclient):
    assert ytclient.recent_videos("UU" + "e" * 22) == []
    assert ytclient.recent_videos(None) == []


def test_quota_guard_blocks_before_calling(db, http, yt):
    client = YouTubeClient(db, "test-key", http, daily_quota=150)
    client.search_channels("alpha")                  # 100 units
    with pytest.raises(QuotaExceeded):
        client.search_channels("beta")               # would reach 200 > 150
    assert yt.count("search") == 1
    client.get_channels([ALPHA])                     # 1-unit calls still fit
    assert client.units_used_today() == 101


def test_upstream_quota_error_maps_to_quota_exceeded(ytclient, yt):
    yt.fail_reason = "quotaExceeded"
    with pytest.raises(QuotaExceeded):
        ytclient.get_channels([ALPHA])


def test_other_upstream_errors(ytclient, yt):
    yt.fail_reason = "forbidden"
    with pytest.raises(YouTubeError) as exc:
        ytclient.get_channels([EMPTY])
    assert exc.value.status_code == 502 and exc.value.upstream_status == 403


def test_missing_api_key(db, http):
    with pytest.raises(NotConfigured):
        YouTubeClient(db, "", http).get_channels([ALPHA])


def test_foreign_keys_are_enforced(db):
    """SQLite must reject orphan rows the way Postgres does."""
    from datetime import date

    import pytest
    from sqlalchemy.exc import IntegrityError

    from app.models import ChannelSnapshot
    db.add(ChannelSnapshot(channel_id="UC" + "q" * 22, day=date(2026, 1, 1), subscribers=1, views=1, videos=1))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
