Summary: Bloonix plugins for web transaction.
Name: bloonix-plugins-wtrm
Version: 0.19
Release: 1%{dist}
License: Commercial
Group: Utilities/System
Distribution: RHEL and CentOS

Packager: Jonny Schulz <js@bloonix.de>
Vendor: Bloonix

BuildArch: noarch
BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root

Source0: http://download.bloonix.de/sources/%{name}-%{version}.tar.gz
Requires: bloonix-core >= 0.20
AutoReqProv: no

%description
bloonix-plugins-wtrm provides plugins to monitor web transactions.

%define blxdir /usr/lib/bloonix
%define docdir %{_docdir}/%{name}-%{version}

%prep
%setup -q -n %{name}-%{version}

%build
%{__perl} Configure.PL --prefix /usr
%{__make}

%install
rm -rf %{buildroot}
%{__make} install DESTDIR=%{buildroot}
mkdir -p ${RPM_BUILD_ROOT}%{docdir}
install -c -m 0444 LICENSE ${RPM_BUILD_ROOT}%{docdir}/
install -c -m 0444 ChangeLog ${RPM_BUILD_ROOT}%{docdir}/

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root)

%dir %{blxdir}
%dir %{blxdir}/plugins
%dir %{blxdir}/js
%{blxdir}/plugins/check-*
%{blxdir}/etc/plugins/plugin-*
%{blxdir}/js/bloonix-wtrm.js

%dir %attr(0755, root, root) %{docdir}
%doc %attr(0444, root, root) %{docdir}/ChangeLog
%doc %attr(0444, root, root) %{docdir}/LICENSE

%changelog
* Tue Feb 21 2017 Jonny Schulz <js@bloonix.de> - 0.19-1
- Fixed utf8 issues.
* Thu Jan 19 2017 Jonny Schulz <js@bloonix.de> - 0.18-1
- Fixed utf8 issues.
* Thu Nov 24 2016 Jonny Schulz <js@bloonix.de> - 0.17-1
- Fixed bloonix-wtrm.js: screenshots are not generated any more
  on doUserAgent and doAddCookie.
* Thu Apr 14 2016 Jonny Schulz <js@bloonix.de> - 0.16-1
- Add new action doAddCookie.
* Tue Mar 29 2016 Jonny Schulz <js@bloonix.de> - 0.15-1
- Extra release because the gpg key of bloonix is updated.
* Mon Nov 30 2015 Jonny Schulz <js@bloonix.de> - 0.14-1
- Added a info that check-wtrm does not validate SSL certificates.
* Mon Nov 30 2015 Jonny Schulz <js@bloonix.de> - 0.13-1
- Delete temporary wtrm files.
* Wed Jun 24 2015 Jonny Schulz <js@bloonix.de> - 0.12-1
- Added new features: doSwitchToNewPage and doSwitchToMainPage.
* Mon Jun 22 2015 Jonny Schulz <js@bloonix.de> - 0.11-1
- Added new features: doTriggerEvent, doSwitchToFrame, doSwitchToParentFrame,
  doDumpContent and doDumpFrameContent.
* Tue Jun 16 2015 Jonny Schulz <js@bloonix.de> - 0.10-1
- The host id and service id is available as options since
  bloonix-core 0.20.
* Wed Apr 22 2015 Jonny Schulz <js@bloonix.de> - 0.9-1
- Kicked value type array.
* Thu Feb 12 2015 Jonny Schulz <js@bloonix.de> - 0.8-1
- New feature: doWaitForElement can now wait for text within an element too.
* Thu Feb 12 2015 Jonny Schulz <js@bloonix.de> - 0.7-1
- New feature: it's now possible to search for tags and attributes.
* Fri Dec 05 2014 Jonny Schulz <js@bloonix.de> - 0.6-1
- Ignoring "Unsafe JavaScript attempt" messages of PhantomJS.
* Thu Dec 04 2014 Jonny Schulz <js@bloonix.de> - 0.5-1
- Fixed doSleep function.
* Wed Dec 03 2014 Jonny Schulz <js@bloonix.de> - 0.4-1
- Fixed UA setting in bloonix-wtrm.js.
- Fixed the check checkUrl.
* Wed Nov 26 2014 Jonny Schulz <js@bloonix.de> - 0.3-1
- Install bloonix-wtrm.js.
- First RPM and DEB package.
* Mon Nov 03 2014 Jonny Schulz <js@bloonix.de> - 0.2-1
- Updated the license information.
* Mon Aug 25 2014 Jonny Schulz <js@bloonix.de> - 0.1-1
- Initial release.
