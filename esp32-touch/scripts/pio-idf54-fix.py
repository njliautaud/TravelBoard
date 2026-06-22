"""PlatformIO pre-build: Arduino 3.x WiFi needs Network library on the include path."""
Import("env")
import os

pkg = env.PioPlatform().get_package_dir("framework-arduinoespressif32")
network_inc = os.path.join(pkg, "libraries", "Network", "src")
if os.path.isdir(network_inc):
    env.Append(CPPPATH=[network_inc])
