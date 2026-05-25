from void.core.modules import list_void_modules


def test_void_modules_are_ordered_and_shell_is_first() -> None:
    modules = list_void_modules()

    assert len(modules) == 7
    assert modules[0].code == "MOD-01"
    assert modules[0].label == "SHELL"


def test_void_module_display_name_format() -> None:
    modules = list_void_modules()

    assert modules[1].display_name == "[MOD-02] JSON_TOOLS"
