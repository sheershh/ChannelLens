from datetime import date

import pytest

from app.analytics import engagement_rate, growth, parse_duration, summarize


@pytest.mark.parametrize("iso,seconds", [("PT58S", 58), ("PT12M30S", 750), ("PT1H2M", 3720),
                                         ("P1DT1S", 86401), ("P0D", 0), ("", 0), (None, 0), ("garbage", 0)])
def test_parse_duration(iso, seconds):
    assert parse_duration(iso) == seconds


def v(vid, views, likes, comments, published, dur=600):
    return {"id": vid, "views": views, "likes": likes, "comments": comments,
            "published_at": published, "duration_seconds": dur}


def test_engagement_rate_handles_hidden_likes_and_zero_views():
    assert engagement_rate(v("x", 1000, 40, 10, None)) == pytest.approx(5.0)
    assert engagement_rate(v("x", 1000, None, 10, None)) is None
    assert engagement_rate(v("x", 0, 5, 1, None)) is None


def test_summarize():
    vids = [v("a", 100_000, 5_000, 1_000, "2026-11-20T00:00:00Z"),
            v("b", 50_000, 2_000, 500, "2026-11-13T00:00:00Z", dur=58),
            v("c", 150_000, 6_000, 1_500, "2026-11-06T00:00:00Z"),
            v("d", 100_000, None, 300, "2026-10-30T00:00:00Z")]
    s = summarize(vids, rpm_low=1.0, rpm_high=4.0)
    assert s["sample_size"] == 4
    assert s["avg_views"] == 100_000 and s["median_views"] == 100_000
    assert s["engagement_rate"] == 5.33          # hidden-likes video excluded from the ratio
    assert s["uploads_per_week"] == 1.0
    assert s["short_form_share"] == 0.25
    assert s["top_video_id"] == "c"
    assert s["est_revenue_usd"] == {"low": 400.0, "high": 1600.0}


def test_summarize_empty():
    s = summarize([])
    assert s["sample_size"] == 0 and s["engagement_rate"] is None and s["top_video_id"] is None


def snap(day, subs, views, videos):
    return {"day": day, "subscribers": subs, "views": views, "videos": videos}


def test_growth_deltas():
    snaps = [snap(date(2026, 10, 20), 900, 9_000, 40), snap(date(2026, 11, 15), 980, 9_800, 44),
             snap(date(2026, 11, 26), 1000, 10_000, 45)]
    g = growth(snaps, today=date(2026, 11, 26))
    assert g["days_tracked"] == 3 and g["since"] == "2026-10-20"
    assert g["d7"] == {"from": "2026-11-15", "subscribers": 20, "views": 200, "videos": 1}
    assert g["d30"] == {"from": "2026-10-20", "subscribers": 100, "views": 1000, "videos": 5}


def test_growth_needs_history():
    g = growth([snap(date(2026, 11, 26), None, 10, 1)], today=date(2026, 11, 26))
    assert g["d7"] is None and g["d30"] is None
    assert growth([], today=date(2026, 11, 26))["days_tracked"] == 0


def test_growth_hidden_subscribers():
    g = growth([snap(date(2026, 11, 1), None, 10, 1), snap(date(2026, 11, 26), None, 30, 2)],
               today=date(2026, 11, 26))
    assert g["d7"]["subscribers"] is None and g["d7"]["views"] == 20
