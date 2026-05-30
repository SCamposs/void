from void.core.modules import get_shell_module_by_id, list_shell_modules


def test_shell_modules_are_ordered_and_shell_is_first() -> None:
    modules = list_shell_modules()

    assert len(modules) == 4
    assert modules[0].code == "MOD-01"
    assert modules[0].module_id == "shell"


def test_shell_module_display_name_format() -> None:
    modules = list_shell_modules()

    assert modules[1].display_name == "[MOD-02] TYPING_TEST"


def test_shell_module_maps_existing_registry_ids() -> None:
    assert get_shell_module_by_id("typing") is not None
    assert get_shell_module_by_id("ascii-orbit") is not None
    assert get_shell_module_by_id("json-tools") is None


def test_shell_module_registry_contains_expected_ids() -> None:
    module_ids = [module.module_id for module in list_shell_modules()]

    assert module_ids == [
        "shell",
        "typing",
        "ascii-orbit",
        "stacker",
    ]
