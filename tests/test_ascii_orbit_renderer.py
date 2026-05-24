from void.modules.ascii_orbit.renderer import render_orbit_frame


def test_render_orbit_frame_returns_string() -> None:
    frame = render_orbit_frame(width=60, height=20, tick=0)

    assert isinstance(frame, str)


def test_render_orbit_frame_line_count_is_reasonable() -> None:
    height = 18
    frame = render_orbit_frame(width=60, height=height, tick=2)

    lines = frame.splitlines()
    assert len(lines) == height


def test_render_orbit_frame_is_deterministic_for_same_inputs() -> None:
    frame_a = render_orbit_frame(width=52, height=16, tick=15)
    frame_b = render_orbit_frame(width=52, height=16, tick=15)

    assert frame_a == frame_b


def test_different_ticks_produce_different_frames() -> None:
    frame_a = render_orbit_frame(width=52, height=16, tick=10)
    frame_b = render_orbit_frame(width=52, height=16, tick=11)

    assert frame_a != frame_b


def test_render_orbit_frame_handles_small_sizes() -> None:
    frame = render_orbit_frame(width=8, height=4, tick=3)

    lines = frame.splitlines()
    assert len(lines) == 4
