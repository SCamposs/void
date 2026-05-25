from void.modules.ascii_orbit.renderer import (
    OrbitMode,
    OrbitRenderConfig,
    build_telemetry,
    render_orbit_frame,
    render_orbit_frame_with_config,
)


def test_render_orbit_frame_returns_string() -> None:
    frame = render_orbit_frame(width=60, height=20, tick=0)

    assert isinstance(frame, str)


def test_render_orbit_frame_with_config_returns_string() -> None:
    config = OrbitRenderConfig(width=60, height=20, tick=0, mode=OrbitMode.GLOBE)
    frame = render_orbit_frame_with_config(config)

    assert isinstance(frame, str)


def test_render_orbit_frame_line_count_is_reasonable() -> None:
    height = 18
    frame = render_orbit_frame(width=60, height=height, tick=2)

    lines = frame.splitlines()
    assert len(lines) == height


def test_output_scales_with_dimensions() -> None:
    small = render_orbit_frame(width=30, height=10, tick=4)
    large = render_orbit_frame(width=90, height=30, tick=4)

    assert len(large) > len(small)


def test_render_orbit_frame_is_deterministic_for_same_inputs() -> None:
    frame_a = render_orbit_frame(width=52, height=16, tick=15)
    frame_b = render_orbit_frame(width=52, height=16, tick=15)

    assert frame_a == frame_b


def test_different_ticks_produce_different_frames() -> None:
    frame_a = render_orbit_frame(width=52, height=16, tick=10)
    frame_b = render_orbit_frame(width=52, height=16, tick=11)

    assert frame_a != frame_b


def test_different_modes_produce_different_frames() -> None:
    globe = render_orbit_frame_with_config(
        OrbitRenderConfig(width=60, height=20, tick=7, mode=OrbitMode.GLOBE)
    )
    scanner = render_orbit_frame_with_config(
        OrbitRenderConfig(width=60, height=20, tick=7, mode=OrbitMode.SCANNER)
    )
    field = render_orbit_frame_with_config(
        OrbitRenderConfig(width=60, height=20, tick=7, mode=OrbitMode.FIELD)
    )

    assert globe != scanner
    assert scanner != field


def test_render_orbit_frame_handles_small_sizes() -> None:
    frame = render_orbit_frame(width=8, height=4, tick=3)

    lines = frame.splitlines()
    assert len(lines) == 4


def test_legacy_render_orbit_frame_api_still_works() -> None:
    frame = render_orbit_frame(width=44, height=12, tick=9)

    assert isinstance(frame, str)
    assert len(frame.splitlines()) == 12


def test_telemetry_is_deterministic_for_same_tick_mode() -> None:
    a = build_telemetry(
        tick=30, mode=OrbitMode.SCANNER, width=80, height=24, detail_level=3
    )
    b = build_telemetry(
        tick=30, mode=OrbitMode.SCANNER, width=80, height=24, detail_level=3
    )

    assert a == b
